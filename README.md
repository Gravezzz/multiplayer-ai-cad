# Multiplayer AI CAD

A shared CAD workspace where people and AI teammates design together.

Hackathon project for Haunted Hacks, October 31, 2026. Working name; independent of Engram.

## Status

Planning repository created during the hackathon. No application or deployed integration yet. Submission: **4:00 p.m. America/Los_Angeles**. Solo builder.

## Product

Hardware teams spend time propagating changes between connected parts. This workspace lets a human change a requirement while AI teammates adapt the affected parts in the same live assembly, with visible proposals and revision history.

The first demonstration is an electronics enclosure: body, lid, and a PCB reference. Two browser sessions share one project. A body agent and a lid agent produce real geometry changes, respond to a changed PCB size, and preserve human edits.

## Decisions

- Browser app: React, TypeScript, Vite, Three.js / React Three Fiber.
- CAD: Replicad over OpenCascade WASM. Real solids, booleans, and STEP export; render tessellated meshes in Three.js.
- Collaboration: a Terse project actor owns the authoritative revision and accepted assembly.
- AI: two specialist runs, executed outside the project actor's serialized commit path; real model calls and structured geometry tools.
- Scope: parameter and feature edits, part selection, orbit, shared activity, proposals, and export. No full sketch editor or general assembly constraint solver.

Read [the architecture](docs/architecture.md), [demo and schedule](docs/demo.md), and [verified sources and open questions](docs/research.md).

## Planned layout

```text
apps/web/           viewport, dimensions, participants, proposals
apps/server/        model calls, authenticated socket grants, geometry validation
actors/            Terse project actor; agent job actors if time permits
packages/protocol/ typed commands, proposals, revisions, geometry specifications
packages/cad/      shared Replicad compiler and validation
```

These directories describe the implementation plan; they are not implemented yet.

## First gate

Before UI polish: demonstrate a real Terse write shared by two clients, and a Replicad hollow box that exports as STEP. Resolve the Terse CLI/package discrepancy against the installed SDK and official starter before writing integration code. Never replace Terse with local-state simulation or replace AI generation with canned geometry responses.
