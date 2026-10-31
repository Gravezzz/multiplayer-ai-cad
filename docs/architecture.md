# Implemented architecture

This document describes the running hackathon implementation, not a proposed cloud deployment.

## Ownership

| State / work | Owner |
|---|---|
| Lobby room names | Terse `RoomDirectory` actor, ID `workspace` |
| Parts, geometry revision, sequence, history, threads/messages, job status | One Terse `ProjectActor` for each room ID |
| Undo history | Same ProjectActor; up to 20 previous part lists |
| Exact imported source solids | Immutable SHA-256-addressed BRep files in `.cad-assets/` |
| Model inference and tool loop | Concurrent tasks in the application server |
| Solid compilation, meshing, rendering, STEP import/export | Isolated OpenCascade worker |
| Camera, selection, unsent per-thread drafts | Individual browser |
| Presence | Transient SSE connections, counted as browser sessions |

Parts are data inside the room actor. AI teammates are model/tool loops; they are not separate Terse actors. In-flight model execution does not resume automatically after API restart, even though its job status and conversation are durable.

## Accepted-edit path

1. A human or model reads revision N.
2. A structured edit identifies upserted/removed part IDs and base revision N.
3. The server validates the schema and compiles upserted solids outside the actor. Each part must have positive finite volume and exactly one connected solid.
4. The actor checks request deduplication and the current revision. A stale proposal fails with `STALE_REVISION`.
5. On acceptance, it records an undo checkpoint and assigns the new document with revision N+1. Unrelated part records remain unchanged.
6. The API broadcasts the state through SSE. Browsers reject older sequence numbers and obtain meshes for the accepted revision.
7. Model tool errors return as observations. On a stale proposal the model is instructed to reread, inspect, and revise. There is no automatic semantic merge or deterministic fallback design.

The guard is room-wide. Two edits to different parts may still require a reread. The actor provides serialized execution; geometry validation and revision policy are application logic. Undo and document fields are separate persisted assignments, so this implementation does not claim a cross-field crash-atomic transaction.

## Conversations

Each thread has a stable ID, a user-chosen label, and durable user/assistant messages. Start admission happens inside the actor: one active run per thread, at most four per room. The next model call contains only the selected thread's conversation and the latest user message, plus generic CAD guidance. It rereads current geometry through tools.

`finish_turn` requires a model-selected `needs_reply` or `complete` status and a message. The UI distinguishes a reply from a geometry commit. No regex or keyword classifier infers whether a message is a question. Names do not imply fixed specialties.

## Geometry tools

`read_assembly`, `measure_assembly`, `inspect_part`, `render_view`, `measure_between`, `preview_design`, `commit_design`, `finish_turn`.

Models receive actual/current candidate render images. They author data validated by schemas, not arbitrary executable JavaScript. Shapes use exact imported source BReps, supported primitive features, and ordered direct-edit operations. Topology indices are scoped to the current shape and may change after edits. Minimum distance zero means contact or overlap, not a correct joint.

STEP import preserves named separate solids and centers the assembly consistently. It does not recover Fusion's feature timeline. STEP export compiles accepted solids with names and colors. STL files are optional read-only references.

## Local runtime

Vite serves the UI on 5173 and proxies `/api` to Bun/Express on 3100. The local Terse runtime uses 7100. Model keys stay server-side, in memory or an ignored environment file. Public authentication, Terse Cloud, and direct browser-to-actor WebSockets are not implemented; browser updates use application-server SSE.

The room directory persists names and IDs. Lobby part/revision/agent counts come from live actor snapshots; connection counts come from active SSE sessions. Thumbnails render accepted CAD and are cached by revision. No simulated rooms, users, or agent activity are included.

## Persistence and limits

Back up `.terse/` and `.cad-assets/` together. Git contains portable STEP examples, not the user's live room database. The CAD worker has a 60-second request timeout and is recreated after failure; failures remain visible. A model run has a 20-turn tool budget and 120-second timeout per provider request.

This is a local trusted-client MVP, not a production authorization boundary. No collision-free assembly, mechanical attachment, anatomical fit, manufacturing suitability, or perfect same-body semantic reconciliation is guaranteed. Read [recorded tests](verified-live-runs.json) for what was actually exercised.
