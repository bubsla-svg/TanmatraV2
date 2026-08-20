---
name: kg
description: Query the repo knowledge graph to find the minimal set of files a task touches, before reading or grepping anything. Use when you need to know what imports a module, what a change can break, which docs describe a file, or where a feature lives. Trigger on any task that begins with "where is", "what uses", "what breaks if", "which files handle", or before editing an unfamiliar file.
---

# Repo knowledge graph

`.kg/graph.json` holds every package, module, doc, and CI workflow in this repo
plus the edges between them (imports, workspace deps, doc→code references).
Query it with `python3 .kg/kg.py <subcommand>`.

## Use this before Grep or Read

A kg call costs a few hundred tokens and returns a file list. Grepping a
2,000-module monorepo costs tens of thousands and returns line noise. Reach for
the graph first; use Grep only once you know which files to look inside.

## Commands

```
kg find <term>                  locate nodes by path or title
kg context <path>               THE READ-SET: file + deps + callers + its docs
kg blast <path> [--depth N]     transitive dependents — what a change can break
kg deps <path>                  what it imports
kg users <path>                 what imports it
kg docs <path>                  docs whose prose references this file
kg code <doc>                   code a doc claims to describe
kg path <a> <b>                 how two things connect
kg hubs [--kind package|doc]    highest-degree nodes
kg stale                        docs referencing files that no longer exist
```

All commands take `--limit N` (default 40).

## The standard opening move

For "change X" or "fix X" tasks, run this first and let the output define which
files enter context:

```
python3 .kg/kg.py context <path>
```

Read the target file. Read a dependency only if you touch it. Check callers for
breakage. Read a listed doc only when the change alters documented behavior.

Before editing anything under `lib/`, run `kg blast` — workspace packages have
large fan-in and the depth-1 number tells you whether this is a contained edit
or a cross-cutting one.

## Interpreting the output

- **Cross-package imports resolve to the package node, not the file.** An edge
  to `@workspace/db` means "something in that package," so `kg blast` bridges
  through package entrypoints. Depth counts hops in the graph, not call depth.
- **`mentions` edges are extracted from backtick-quoted paths in markdown.** A
  doc appearing under `kg docs` claims to describe the file; it may be wrong or
  outdated. Treat it as a lead, not as truth.
- **A file absent from the graph is not absent from the repo.** The extractor
  covers TS/JS and markdown and skips `.claude/` and `.agents/` skill packs. It
  resolves static imports, `@/` path-alias imports, and dynamic `import()` with
  a **literal** specifier (so `React.lazy(() => import("@/x"))` is an edge).
  Still invisible: paths built from variables or template strings, and anything
  reached by a runtime registry. When the graph says nothing, fall back to Grep.

- **A missing edge is the dangerous direction.** It makes a live module look
  orphaned, which is how a dead-code sweep deletes something the app loads at
  runtime. Before acting on "nothing depends on this", grep the basename — a
  cheap second opinion that costs one call. Literal dynamic imports went
  unresolved until 2026-08-20 and did exactly this to
  `components/CommandPalette.tsx`.

## Staleness

The graph is a snapshot. If `git log` shows commits after `.kg/graph.json`'s
mtime and the answer looks wrong, regenerate:

```
python3 .kg/kg_extract.py . .kg/graph.json
```

Measured on this repo: about 5 seconds for ~2,300 nodes. Cheap enough to rerun
after any merge you're about to work on top of — but don't wire it into a
per-edit hook; the graph only needs to be as fresh as the tree you're editing.
