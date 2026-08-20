#!/usr/bin/env python3
"""
kg — query a kg_extract.py graph. Built to answer an agent in a few hundred
tokens instead of a few hundred thousand.

  kg find <term>              locate nodes by path/label
  kg deps <path>              what this file imports (1 hop out)
  kg users <path>             what imports this file (1 hop in)
  kg blast <path> [--depth N] transitive reverse deps — what a change can break
  kg context <path>           minimal read-set for editing this file
  kg docs <path>              docs whose prose references this code path
  kg code <doc>               code a doc claims to describe
  kg path <a> <b>             how two nodes connect
  kg hubs [--kind K]          highest-degree nodes
  kg stale                    docs referencing paths that no longer exist
  kg orphans                  docs nothing links to

Graph location: $KG_FILE, else ./.kg/graph.json
"""
import json, os, sys, argparse
from collections import defaultdict, deque
from pathlib import Path

GRAPH = Path(os.environ.get("KG_FILE", ".kg/graph.json"))
if not GRAPH.exists():
    sys.exit(f"no graph at {GRAPH} — run kg_extract.py, or set KG_FILE")

G = json.loads(GRAPH.read_text())
NODES = {n["id"]: n for n in G["nodes"]}
OUT, IN = defaultdict(list), defaultdict(list)
for e in G["edges"]:
    OUT[e["src"]].append((e["dst"], e["kind"]))
    IN[e["dst"]].append((e["src"], e["kind"]))


def resolve(term):
    """Accept a path, a partial path, or a node id. Exact-ish wins."""
    if term in NODES:
        return term
    t = term.lstrip("./")
    exact = [n for n in NODES.values() if n.get("path") == t]
    if exact:
        return exact[0]["id"]
    hits = [n for n in NODES.values()
            if t.lower() in (n.get("path") or "").lower()
            or t.lower() in (n.get("label") or "").lower()]
    if not hits:
        sys.exit(f"no node matching {term!r}")
    if len(hits) > 1:
        hits.sort(key=lambda n: (len(n.get("path", "")), -n["degree"]))
        if hits[0].get("path", "").endswith(t):
            return hits[0]["id"]
        print(f"# {len(hits)} matches, using the shortest path; others:", file=sys.stderr)
        for h in hits[1:6]:
            print(f"#   {h['path']}", file=sys.stderr)
    return hits[0]["id"]


def p(nid):
    n = NODES.get(nid, {})
    return n.get("path", nid)


def show(nid):
    n = NODES[nid]
    return f"{n['kind']:8} {n.get('path', nid)}"


def cmd_find(a):
    t = a.term.lower()
    hits = [n for n in NODES.values()
            if t in (n.get("path") or "").lower() or t in (n.get("label") or "").lower()]
    hits.sort(key=lambda n: -n["degree"])
    for n in hits[:a.limit]:
        print(f"{n['degree']:5}  {n['kind']:8} {n.get('path', n['id'])}")
    print(f"# {len(hits)} matches")


def _hop(nid, table, kinds):
    seen = {}
    for other, k in table[nid]:
        if kinds and k not in kinds:
            continue
        seen.setdefault(other, k)
    return seen


def cmd_deps(a):
    nid = resolve(a.path)
    print(f"# {p(nid)} imports:")
    for o, k in sorted(_hop(nid, OUT, {"imports", "depends_on"}).items(), key=lambda x: p(x[0])):
        print(f"  {k:11} {p(o)}")


def cmd_users(a):
    nid = resolve(a.path)
    print(f"# imported by ({p(nid)}):")
    for o, k in sorted(_hop(nid, IN, {"imports", "depends_on"}).items(), key=lambda x: p(x[0])):
        print(f"  {k:11} {p(o)}")


ENTRY = ("/src/index.ts", "/src/index.tsx", "/index.ts", "/index.tsx")


def _reverse(f):
    """Who depends on f. Cross-package imports land on the package node, so a
    module re-exported through its package entrypoint must bridge through that
    package or the radius stops dead at the workspace boundary."""
    out = [(o, k) for o, k in IN[f] if k in ("imports", "depends_on")]
    n = NODES[f]
    pkgpath = (NODES.get(n.get("pkg")) or {}).get("path")
    if n["kind"] == "module" and pkgpath and n.get("path") in (
            f"{pkgpath}{e}" for e in ENTRY):
        out += [(o, k) for o, k in IN[n["pkg"]] if k in ("imports", "depends_on")]
    return out


def cmd_blast(a):
    nid = resolve(a.path)
    layers, seen, frontier = [], {nid}, {nid}
    for d in range(a.depth):
        nxt = set()
        for f in frontier:
            for o, k in _reverse(f):
                if o not in seen:
                    seen.add(o)
                    nxt.add(o)
        if not nxt:
            break
        layers.append(nxt)
        frontier = nxt
    print(f"# blast radius of {p(nid)}")
    total = 0
    for i, layer in enumerate(layers, 1):
        mods = sorted(p(x) for x in layer)
        total += len(mods)
        print(f"## depth {i}: {len(mods)}")
        for m in mods[:a.limit]:
            print(f"  {m}")
        if len(mods) > a.limit:
            print(f"  … +{len(mods)-a.limit} more")
    print(f"# {total} dependents total")


def cmd_context(a):
    """The read-set: the file, what it imports, its closest users, its docs."""
    nid = resolve(a.path)
    n = NODES[nid]
    print(f"# READ FIRST\n  {n.get('path')}")
    deps = sorted(_hop(nid, OUT, {"imports"}), key=p)
    if deps:
        print(f"# ITS DEPENDENCIES ({len(deps)}) — read only those you touch")
        for d in deps[:a.limit]:
            print(f"  {p(d)}")
    users = sorted(_hop(nid, IN, {"imports"}), key=p)
    if users:
        print(f"# CALLERS ({len(users)}) — check these for breakage")
        for u in users[:a.limit]:
            print(f"  {p(u)}")
    # De-dup: two different backtick spans in one doc ("schema/index.ts" and
    # "lib/db/src/schema/index.ts") resolve to the same file and produce two
    # mentions edges; the count must be of docs, not of edges.
    docs = {o for o, k in IN[nid] if k == "mentions" and NODES[o]["kind"] == "doc"}
    if docs:
        print(f"# DOCS DESCRIBING IT ({len(docs)})")
        for d in sorted(docs, key=p):
            print(f"  {p(d)}")
    pkg = n.get("pkg")
    if pkg:
        print(f"# PACKAGE\n  {p(pkg)}")


def cmd_docs(a):
    nid = resolve(a.path)
    seen = set()
    for o, k in IN[nid]:
        if k == "mentions" and NODES[o]["kind"] == "doc" and o not in seen:
            seen.add(o)
            print(f"  {NODES[o].get('words',0):6}w  {p(o)}")


def cmd_code(a):
    nid = resolve(a.doc)
    for o, k in OUT[nid]:
        if k == "mentions":
            print(f"  {show(o)}")


def cmd_path(a):
    s, t = resolve(a.a), resolve(a.b)
    prev, q = {s: None}, deque([s])
    while q:
        cur = q.popleft()
        if cur == t:
            chain = []
            while cur:
                chain.append(cur)
                cur = prev[cur]
            for step in reversed(chain):
                print(f"  {show(step)}")
            return
        for o, _ in OUT[cur] + IN[cur]:
            if o not in prev:
                prev[o] = cur
                q.append(o)
    print("# no connection")


def cmd_hubs(a):
    ns = [n for n in NODES.values() if not a.kind or n["kind"] == a.kind]
    for n in sorted(ns, key=lambda x: -x["degree"])[:a.limit]:
        print(f"{n['degree']:5}  {n['kind']:8} {n.get('path', n['id'])}")


def cmd_stale(a):
    docs = [n for n in NODES.values() if n["kind"] == "doc"]
    bad = [d for d in docs if not any(k == "mentions" for _, k in OUT[d["id"]])]
    for d in sorted(bad, key=lambda x: -x.get("words", 0))[:a.limit]:
        print(f"{d.get('words',0):6}w  {d['path']}")
    print(f"# {len(bad)}/{len(docs)} docs reference no existing file")


def cmd_orphans(a):
    for n in sorted((n for n in NODES.values()
                     if n["kind"] == "doc" and n["degree"] == 0),
                    key=lambda x: -x.get("words", 0))[:a.limit]:
        print(f"{n.get('words',0):6}w  {n['path']}")


ap = argparse.ArgumentParser(prog="kg", add_help=True)
sub = ap.add_subparsers(dest="cmd", required=True)
def add(name, fn, *args):
    s = sub.add_parser(name)
    for arg in args:
        s.add_argument(arg)
    s.add_argument("--limit", type=int, default=40)
    s.set_defaults(fn=fn)
    return s
add("find", cmd_find, "term")
add("deps", cmd_deps, "path")
add("users", cmd_users, "path")
add("blast", cmd_blast, "path").add_argument("--depth", type=int, default=3)
add("context", cmd_context, "path")
add("docs", cmd_docs, "path")
add("code", cmd_code, "doc")
add("path", cmd_path, "a", "b")
add("hubs", cmd_hubs).add_argument("--kind")
add("stale", cmd_stale)
add("orphans", cmd_orphans)
a = ap.parse_args()
a.fn(a)
