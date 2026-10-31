# Assembly — multiplayer AI CAD

A browser CAD workspace where humans and AI teammates share a versioned mechanical design. Built during Haunted Hacks, October 31, 2026. Submission deadline: 4 p.m. Pacific.

## Demo concept

Start with the founder's real wearable imported from STEP as eight editable solid bodies. Ask one agent to modify the existing band and another to work on a separately requested component. Humans edit the same document. Obsolete proposals return to the model for revision.

STL files remain optional read-only visual references. STEP preserves exact solid geometry and separate bodies; it does not recover Fusion sketches, constraints, joints, or the modeling timeline. The `.f3d` archive is useful for continuing in Fusion but is not currently imported by this app. Supplied device designs predate the hackathon; application code was written during it.

## Current implementation

- React/Three.js workspace: STEP import, body selection, manual transforms, generated-feature dimensions, editable CAD specification, geometry inspection, shared undo, and STEP export.
- Replicad/OpenCascade worker: exact imported BRep solids; boxes, cylinders, spheres, annular arcs and polygon extrusions; unions, differences, intersections, arbitrary-axis rotations, translation, scaling, clipping, edge fillets/chamfers, and shelling. Positive-volume and single-solid validation; invalid operations fail explicitly.
- Terse ProjectActor persists the document, revision guards, operation deduplication, undo checkpoints, jobs, and activity. Browser updates use application-server SSE.
- Real Responses API agents use read, inspect, measure, render, preview, and commit tools. Model requests contain only the user's task and generic CAD guidance. No automatic target image, electrode instructions, canned geometry plans, or provider fallback.
- Agents see renders of the actual current/candidate solids. Model reasoning chooses the geometry operations; CAD mathematics and revision checks validate them.
- The typed [client SDK](packages/sdk.ts) exposes the same document editing, STEP import, inspection, and undo API.
- Model credentials remain in server memory and must be re-entered after restart. Geometry assets persist locally in ignored `.cad-assets/`; actor data persists in ignored `.terse/`. Both are needed to recover imported projects.

**Verified:** the supplied STEP imports eight named solids; band transforms preserve source geometry and volume; unrelated bodies retain identical mesh vertices, triangles, normals, bounds, and volume; stale writes are rejected; undo restores the accepted geometry; all eight solids export and re-import. A real band-only agent run retained the imported source and used rotate/clip/boolean edits, leaving the other seven bodies unchanged and adding no electrode. It correctly reported that preserving the other bodies left some hooks disconnected. Two concurrent live agents also passed: one received a natural stale-revision conflict, re-read the design, and preserved the other agent’s accepted edit. See [recorded verification](docs/verified-live-runs.json).

**Limits:** this is a direct-solid editing MVP, not Fusion's full feature/constraint system. It has no arbitrary surface editor, assembly mating solver, automatic connectivity enforcement, or fit/manufacturing validation. Terse Cloud and public hosting remain unconfigured. Model jobs do not automatically resume after API restart. Successful geometric operations do not establish design quality; inspect each result.

## Run

On this Windows checkout (the required Linux Bun and esbuild tools are installed in the chat's work/ directory):

```powershell
npm install
npm run server:windows
# Second terminal
npm run dev
```

Open http://127.0.0.1:5173/?room=wearable-editable-2026. Open that same URL in a second browser session. Use Settings to enter the hackathon OpenAI key, endpoint, and model. The model must support Responses API tool calling and image input. The server reads optional OPENAI_API_KEY, OPENAI_BASE_URL, and OPENAI_MODEL environment variables as well.

On a separate Linux/macOS machine: install Bun >=1.4.2, install dependencies on that OS, then `bun server/index.ts`; use `npm run dev` for the frontend. Do not share Windows node_modules with Linux without the explicit cross-platform esbuild setup used by the Windows launcher.

This is a **local-only development server**. Public deployment needs authenticated room access, a protected model configuration path, a selected hosting target, and Terse Cloud configuration. Copying the localhost share link allows another session on this laptop to join; it does not make the laptop reachable from other devices.

## Verify

```text
npm run build
npm test
npm run test:cad
npm run test:integration   # Requires the running API/actor server
npx tsx server/test-operations.ts
npx tsx server/test-import.ts path/to/design.step
npx tsx tests/step-integration.ts # Requires the imported wearable demo room
```

The integration test uses a separate room and verifies real actor writes, duplicate delivery, stale rejection, invalid-geometry rejection, mesh generation, and STEP export. The CAD smoke test reimports STEP and checks volume. `bun tests/persistence.ts` in Linux starts a separate actor runtime, writes a revision, restarts it, and checks recovery.

## Structure

```text
src/                    CAD workspace
server/                 local API, model loop, isolated CAD worker
actors/                 authoritative Terse ProjectActor
packages/protocol.ts     shared commands and revision invariants
packages/cad.ts          explicit geometry operations
packages/sdk.ts          typed programmatic client
public/references/      user-supplied reference assets
tests/                  concurrency and real integration checks
```

See [demo script](docs/demo.md), [initial architecture](docs/architecture.md), and [source research](docs/research.md). The README describes the implemented scope; architecture notes record the initial design and deferred work.
