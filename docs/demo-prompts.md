# Copy-ready demo prompts

These are user-visible briefs, not application logic or preset geometry. Start with `examples/wearable/original.step` imported once into a fresh room. The nominal contact location comes from the reviewed demo result, not an anatomical measurement.

## Agent: Band

```text
Convert this wearable's behind-head structure into a clean overhead headphone-style band. Inspect the actual assembly first. Remove or redesign obsolete rear hooks and supports so no abandoned support pieces remain floating. Preserve the exact geometry and placement of Front_Right and Ref_module; the existing electrode modules are to be reused. Keep a restrained silhouette, consistent section, and the existing sage housing color. Use the actual module interfaces to position the overhead band. Another teammate is adding an under-chin support: preserve their new parts and edits. Preview the result before committing. Report unresolved attachment gaps rather than claiming it is mechanically validated.
```

## Agent: Electrode

```text
Add a compact under-chin electrode assembly while reusing the existing wearable modules. Keep Front_Right and Ref_module geometry and positions unchanged. For this demo design, use +X as forward, Z as up, and nominal electrode center (70, 0, -81) mm; these are design assumptions, not validated head fit. Use one slender, smoothly curved side arm attached near Front_Right, ending in a compact rounded carrier around a single upward-facing silver contact, approximately 18 mm in diameter. Aim for an arm around 8 mm wide and 4 mm thick, with rounded edges and transitions, and a carrier around 23 mm across. Match the existing sage housing color. Avoid an angular bracket or broad tray. Inspect the actual geometry to choose attachment details. Another teammate is redesigning the overhead band and removing obsolete rear supports: preserve their work. Review front, side, and isometric previews, refine bulky proportions or abrupt transitions, and commit. Report remaining attachment gaps and assumptions.
```

These combine the successful form-factor direction with the successful refinement brief. They do not guarantee identical output; rehearse the combined first-pass request before recording. The prior recorded result required a refinement turn.

## Short follow-up in Electrode's existing conversation

```text
Make the silver contact 1 mm thinner while keeping its upper contact surface at the same height. Preserve the support, carrier, band, and original modules. Inspect and preview before committing.
```

Use this only if the generated contact can accommodate that reduction. If the initial result needs visual refinement instead, request that real improvement.

## Optional human edit

While an agent is working, select a part, change its name to a useful descriptive label, and Apply change. That creates a shared revision without disrupting the shape. Show the second browser updating. If an agent's old revision is rejected, show the actual conflict and repair. Do not promise a conflict on cue.

## Keep the demo bounded

Do not add RF sensors, electronics redesign, or arbitrary same-body mounting changes to this take. The core is simultaneous agents, shared durable CAD, preservation of accepted work, and a clean result. Same-body attachment redesign is a later stress test; it has not been demonstrated by the independent-body conflict test.
