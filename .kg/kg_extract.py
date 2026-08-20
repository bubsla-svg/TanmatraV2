#!/usr/bin/env python3
"""
Build a knowledge graph from an existing repo.

Nodes:  package | module (ts/tsx) | doc (md) | workflow (ci)
Edges:  imports | depends_on | links_to | mentions | owns

Usage: python3 kg_extract.py <repo_root> <out.json>
"""
import json, os, re, sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2])

SKIP_DIRS = {".git", "node_modules", "dist", "build", ".next", "coverage",
             ".turbo", ".pnpm-store", "attached_assets", ".venv"}
CODE_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs"}

nodes, edges = {}, []


def add_node(nid, kind, **attrs):
    if nid not in nodes:
        nodes[nid] = {"id": nid, "kind": kind, **attrs}
    else:
        nodes[nid].update(attrs)
    return nid


def add_edge(src, dst, kind):
    edges.append({"src": src, "dst": dst, "kind": kind})


def walk(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")
                       or d in (".github",)]
        for fn in filenames:
            yield Path(dirpath) / fn


files = list(walk(ROOT))
rel = lambda p: str(p.relative_to(ROOT))

# ---------- 1. packages (the spine) ----------
pkg_by_name, pkg_dirs = {}, []
for p in files:
    if p.name == "package.json" and "node_modules" not in str(p):
        try:
            d = json.loads(p.read_text())
        except Exception:
            continue
        name = d.get("name")
        if not name:
            continue
        nid = f"pkg:{name}"
        add_node(nid, "package", label=name, path=rel(p.parent),
                 scripts=sorted(d.get("scripts", {}))[:40])
        pkg_by_name[name] = nid
        pkg_dirs.append((p.parent, nid))
        for dep, ver in {**d.get("dependencies", {}), **d.get("devDependencies", {})}.items():
            if dep.startswith("@workspace/") or str(ver).startswith("workspace:"):
                add_edge(nid, f"pkg:{dep}", "depends_on")

pkg_dirs.sort(key=lambda t: len(str(t[0])), reverse=True)  # deepest first
pkg_dir_by_id = {nid: d for d, nid in pkg_dirs}


def owning_pkg(path):
    for d, nid in pkg_dirs:
        try:
            path.relative_to(d)
            return nid
        except ValueError:
            continue
    return None


# ---------- 2. modules + import edges ----------
IMPORT_RE = re.compile(r"""(?:from|import|require\()\s*['"]([^'"]+)['"]""")
module_ids = set()

for p in files:
    if p.suffix not in CODE_EXT or "node_modules" in str(p):
        continue
    src = f"mod:{rel(p)}"
    module_ids.add(src)
    owner = owning_pkg(p)
    add_node(src, "module", label=p.name, path=rel(p), pkg=owner)
    if owner:
        add_edge(owner, src, "owns")
    try:
        text = p.read_text(errors="ignore")
    except Exception:
        continue
    def resolve_file(target):
        for cand in [target, *(target.with_suffix(e) for e in CODE_EXT),
                     *(target / f"index{e}" for e in CODE_EXT)]:
            if cand.is_file():
                return cand
        return None

    for spec in set(IMPORT_RE.findall(text)):
        if spec.startswith("."):
            hit = resolve_file((p.parent / spec).resolve())
            if hit:
                add_edge(src, f"mod:{rel(hit)}", "imports")
        elif spec.startswith("@workspace/"):
            base = "/".join(spec.split("/")[:2])
            add_edge(src, f"pkg:{base}", "imports")
        elif spec.startswith("@/") and owner:
            # tsconfig path alias. The storefront maps @/ to the package root
            # (no src/); the legacy SPA maps it to src/. Without this branch
            # every app/->lib/ edge in the storefront is invisible and blast
            # radii there understate — heroCampaign.ts showed one dependent
            # (its test) while the homepage was importing it via @/.
            base = pkg_dir_by_id[owner]
            hit = resolve_file(base / spec[2:]) or resolve_file(base / "src" / spec[2:])
            if hit:
                add_edge(src, f"mod:{rel(hit)}", "imports")

# ---------- 3. docs + link/mention edges ----------
MD_LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
WIKI_LINK = re.compile(r"\[\[([^\]|]+)")
PATH_MENTION = re.compile(r"`([\w./@-]+\.(?:ts|tsx|md|sql|yaml|yml|json))`")
H1 = re.compile(r"^#\s+(.+)$", re.M)

doc_by_rel = {}
for p in files:
    if p.suffix.lower() != ".md" or "node_modules" in str(p):
        continue
    doc_by_rel[rel(p)] = f"doc:{rel(p)}"

for p in files:
    if p.suffix.lower() != ".md" or "node_modules" in str(p):
        continue
    did = f"doc:{rel(p)}"
    try:
        text = p.read_text(errors="ignore")
    except Exception:
        text = ""
    m = H1.search(text)
    add_node(did, "doc", label=(m.group(1).strip() if m else p.stem),
             path=rel(p), pkg=owning_pkg(p), words=len(text.split()))

    for target in set(MD_LINK.findall(text)) | set(WIKI_LINK.findall(text)):
        if target.startswith(("http", "#", "mailto:")):
            continue
        t = (p.parent / target.split("#")[0]).resolve()
        for cand in (t, t.with_suffix(".md")):
            try:
                r = str(cand.relative_to(ROOT))
            except ValueError:
                continue
            if r in doc_by_rel:
                add_edge(did, doc_by_rel[r], "links_to")
                break

    for mention in set(PATH_MENTION.findall(text)):
        if mention.endswith(".md"):
            for r, nid in doc_by_rel.items():
                if r.endswith(mention.lstrip("./")):
                    add_edge(did, nid, "mentions")
                    break
        else:
            cand = f"mod:{mention.lstrip('./')}"
            if cand in module_ids:
                add_edge(did, cand, "mentions")
            else:
                for mid in module_ids:
                    if mid.endswith("/" + mention.lstrip("./")):
                        add_edge(did, mid, "mentions")
                        break

# ---------- 4. CI workflows ----------
for p in files:
    if ".github/workflows" in str(p) and p.suffix in (".yml", ".yaml"):
        wid = f"ci:{p.name}"
        text = p.read_text(errors="ignore")
        name = re.search(r"^name:\s*(.+)$", text, re.M)
        add_node(wid, "workflow", label=(name.group(1).strip() if name else p.stem),
                 path=rel(p))
        for pkg_name, nid in pkg_by_name.items():
            short = pkg_name.split("/")[-1]
            if re.search(rf"\b{re.escape(short)}\b", text):
                add_edge(wid, nid, "mentions")

# ---------- 5. prune dangling + emit ----------
known = set(nodes)
edges = [e for e in edges if e["src"] in known and e["dst"] in known]

deg = {n: 0 for n in nodes}
for e in edges:
    deg[e["src"]] += 1
    deg[e["dst"]] += 1
for n, d in deg.items():
    nodes[n]["degree"] = d

OUT.write_text(json.dumps({"nodes": list(nodes.values()), "edges": edges}, indent=1))

from collections import Counter
print(f"nodes {len(nodes)}  edges {len(edges)}")
print("by kind:", dict(Counter(n["kind"] for n in nodes.values())))
print("by edge:", dict(Counter(e["kind"] for e in edges)))
print("\norphans (degree 0):",
      sum(1 for n in nodes.values() if n["degree"] == 0))
print("\ntop 15 by degree:")
for n in sorted(nodes.values(), key=lambda x: -x["degree"])[:15]:
    print(f"  {n['degree']:5}  {n['kind']:9} {n['path']}")
print("\ntop 10 orphan docs (unreferenced, unreferencing):")
orph = [n for n in nodes.values() if n["kind"] == "doc" and n["degree"] == 0]
for n in sorted(orph, key=lambda x: -x.get("words", 0))[:10]:
    print(f"  {n.get('words',0):6} words  {n['path']}")
print(f"\n  ...{len(orph)} orphan docs total")
