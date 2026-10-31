# Assembly — multiplayer AI CAD

A browser CAD workspace where humans and AI teammates share a versioned mechanical design. Built during Haunted Hacks, October 31, 2026. Submission deadline: 4 p.m. Pacific.

## Demo concept

Start with the founder's existing behind-head wearable as an imported reference. Ask one agent to design an editable over-head band and another to build an under-chin electrode support, pad, and distinct metallic contacts. Keep editing dimensions while they work. Their commits are validated against the latest shared revision; obsolete proposals return to the model for repair.

The original and target STL files are read-only reference assets supplied by the user. This app does not recover Fusion history or pretend to directly edit imported mesh features. New parts are real OpenCascade solids and export to STEP. Existing assets predate the hackathon; application code was written during it.

## Current implementation

- React/Three.js workspace with original and target STL reference toggles, orbit controls, part selection, and a human dimension/feature inspector.
- Replicad/OpenCascade kernel in an isolated server worker: boxes, cylinders, curved bands, transforms, unions and cuts. Positive-volume and single-solid validation.
- Real Terse ProjectActor in local Ubuntu WSL: durable document, revision checks, operation deduplication, job states, and activity history.
- Browser synchronization through application-server SSE. Terse owns durable state and serializes writes; this version does not use direct browser-to-actor WebSockets.
- Concurrent real Responses API agent loops with read, measure, and commit tools; target concept image in context. No canned model responses or automatic provider fallback.
- A typed [client SDK](packages/sdk.ts) uses the same editing API as humans.
- Local Settings sends the model key to server memory; no browser storage or Git persistence.

**Not yet verified:** live model-generated band/electrode results, model repair after a live conflict, Terse Cloud deployment, or public hosting. These need credentials and live testing. No anatomical fit, electrical performance, manufacturing readiness, or general collision guarantee is claimed. Model jobs do not automatically resume after an application-server restart.

## Run

On this Windows checkout (the required Linux Bun and esbuild tools are installed in the chat's work/ directory):

```powershell
npm install
npm run server:windows
# Second terminal
npm run dev
```

Open http://127.0.0.1:5173/?room=wearable-demo-2026. Open that same URL in a second browser session. Use Settings to enter the hackathon OpenAI key, endpoint, and model. The model must support Responses API tool calling and image input. The server reads optional OPENAI_API_KEY, OPENAI_BASE_URL, and OPENAI_MODEL environment variables as well.

On a separate Linux/macOS machine: install Bun >=1.4.2, install dependencies on that OS, then `bun server/index.ts`; use `npm run dev` for the frontend. Do not share Windows node_modules with Linux without the explicit cross-platform esbuild setup used by the Windows launcher.

This is a **local-only development server**. Public deployment needs authenticated room access, a protected model configuration path, a selected hosting target, and Terse Cloud configuration. Copying the localhost share link allows another session on this laptop to join; it does not make the laptop reachable from other devices.

## Verify

```text
npm run build
npm test
npm run test:cad
npm run test:integration   # Requires the running API/actor server
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
