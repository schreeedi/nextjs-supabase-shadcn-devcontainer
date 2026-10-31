# Architecture Decision Records

Why the system is built the way it is. Code shows _what_ was decided; an ADR
keeps _why_, and which alternatives were rejected — so nobody (human or agent)
"fixes" a deliberate choice without knowing its reasons.

## When to write one

A decision that is expensive to reverse or that someone would plausibly
question later:

- a technology or service choice (queue, auth, hosting, payment provider)
- a cross-cutting pattern every feature has to follow (gating, logging, jobs)
- a deliberate _non_-choice ("we don't cache HTML at the proxy")
- deviating from a framework/library default or from an earlier ADR

Not for: bug fixes, refactorings within one module, naming.

## How

- File: `NNN-kebab-title.md`, numbered sequentially, never renumbered.
- Copy [000-template.md](000-template.md). Keep it to one screen.
- Status: `Proposed` → `Accepted`; later `Superseded by ADR-NNN` or
  `Deprecated`. Don't rewrite an accepted ADR's decision — write a new one
  that supersedes it and link both ways.
- Link the ADR from the code that embodies it (a comment with the path) and
  list it below.

## Index

| ADR                                           | Decision                                     | Status   |
| --------------------------------------------- | -------------------------------------------- | -------- |
| [001](001-background-jobs-on-pgmq.md)         | Background jobs on Supabase Queues (pgmq)    | Accepted |
| [002](002-single-plan-feature-register.md)    | One plan/feature register, one gate function | Accepted |
| [003](003-proxy-caches-only-static-assets.md) | Reverse proxy caches only `/_next/static`    | Accepted |
