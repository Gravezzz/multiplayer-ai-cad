# Demo: real collaborative edits to an existing device

Start in `wearable-editable-2026`. This room contains eight editable solids imported from the user's STEP export. The previous `wearable-demo-2026` room is preserved separately and contains the earlier generated design.

1. Show the physical wearable and its eight-body STEP model. Explain that the product is a shared CAD editor; Engram supplies the example device.
2. Ask one teammate: “Modify the existing behind-head band into an over-head band, like headphones. Preserve the other existing components. Inspect the actual geometry and explain design assumptions.”
3. Separately ask the second teammate to add the under-chin electrode support and distinct contact pads. This intent must come from the user; it is not injected into band requests.
4. Make a human change using a selected body's Move / rotate controls. Stage the operation, then Apply change. Watch the other browser update. If a stale proposal occurs, the model receives the error, re-reads the current design, and decides how to revise it.
5. Inspect the resulting bodies and the agent's stated limitations. Original band-mounted hooks may need a follow-up attachment task after the band moves. Do not describe detached parts as a finished assembly.
6. Show Undo, reload the second session, and export STEP. Explain that Terse serializes and persists accepted design edits; it does not decide mechanically correct geometry. The model plans changes using the CAD tools.

## Actual test evidence

The band-only run in `band-agent-check-65c24173e440` retained the original band asset and applied rotation, plane clipping, an additive box, and a subtractive box. It changed only that body, kept the other seven body records identical, and added no electrode. Its final message disclosed detached features and unvalidated fit. This is a real recorded model run, not a replay or preset.

The source import test checks eight named solids, direct transform volume preservation, and eight-body STEP re-import. The integration test checks unchanged bodies' geometric arrays, stale-revision rejection, shared undo, and export. The kernel checks also exercise fillet, chamfer, shell, clip, cylinder cut, polygon extrusion, sphere, rotation, scale, and minimum distance.

The live two-agent run in `parallel-check-54dfd428` produced a natural stale-revision conflict. The second agent re-read the assembly and committed its independent body translation while preserving the first translation. Final body records were checked against the original, including all six unrelated bodies.

## Pitch

“Hardware teams change connected parts together. We're building a shared CAD workspace where you and AI teammates can edit the real design at the same time, with durable state and explicit conflict handling.”

The first customer hypothesis is small hardware teams iterating housings, mounts, and fixtures. Reduced redesign and coordination effort is the business hypothesis; willingness to pay is not yet validated.

## Boundaries to state honestly

- Imported STEP solids are editable; Fusion's timeline and sketch constraints are not imported.
- Geometry validity is checked, but mechanical connections, clearance, ergonomics, electronics, and manufacturing need review.
- No canned completions, automatic provider fallback, or target-shaped replacement is used when a tool fails.
- This is local on the laptop; a localhost share URL does not provide access from other devices.
- Hosted deployment, authentication, and Terse Cloud setup remain separate work.
- Demo video should show real model progress. If inference is slow, show accepted state; do not fake completion.
