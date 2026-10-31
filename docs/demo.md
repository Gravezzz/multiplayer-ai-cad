# Demo and build schedule

## Pitch

“Hardware teams don't design one part at a time. They change connected parts together. We're building a shared CAD workspace where AI teammates coordinate those changes alongside you.”

Initial customer hypothesis: small hardware and robotics teams iterating enclosures, fixtures, and mounts. Start with the repetitive redesign caused by changing boards or components. Pricing and willingness to pay remain unvalidated. Multiplayer alone is not the business claim; reduced coordination and redesign effort is the hypothesis to test.

## Two-minute live demo

1. **0:00–0:15 — Establish reality.** Open the same assembly in two browser sessions. Show an enclosure body, lid, and PCB reference. Explain that the starter geometry was created during this hackathon.
2. **0:15–0:40 — Assign work.** Ask the body agent to add board supports and the lid agent to add ventilation while preserving the shared interface. Display actual running status and proposals.
3. **0:40–1:15 — Introduce a live change.** In the other session, increase PCB width from 40 to 48 mm while an agent is still working. Both sessions reflect the accepted dimension. An obsolete proposal is rejected, and the model revises it against the current interface.
4. **1:15–1:40 — Inspect the result.** Accept valid proposals, show the assembled and exploded views, and identify the changed parts. Show measured dimensions only for checks implemented in the application.
5. **1:40–2:00 — Prove usefulness.** Refresh one session, show the accepted project restored, and download STEP. Explain that Terse owns the project's durable state and serializes competing commits.

If inference runs slowly, show its real progress and inspect the last accepted assembly. Do not switch to prerecorded agent actions or fake a completion. A separately labeled demo recording can document an earlier successful run for submission.

## Schedule: solo, hard stop at 4:00 p.m. Pacific

| Target | Deliverable / gate |
| --- | --- |
| 12:45–1:10 | Prove Terse local/deployed counter shared across two clients; prove Replicad hollow solid and STEP export. Pin working SDK versions. |
| 1:10–1:55 | Build viewport and assembly spec; shared project actor; human dimension edits; reconnect snapshot. |
| 1:55–2:40 | Real model tool loop, body/lid roles, proposals, validation, stale-revision rejection and model repair. |
| 2:40–3:10 | Deploy end-to-end, open two sessions, verify secret boundaries and geometry worker. |
| 3:10–3:35 | Run the live-change scenario repeatedly, fix actual failures, finish readable UI and export. |
| 3:35–3:50 | Record a real run, write submission, rehearse the short pitch. Feature freeze. |
| 3:50–4:00 | Submit in Builderbase and confirm submission receipt. |

Times are targets, not promises. If time slips, cut fillets, cursor rendering, extra agents, generalized sketching, and animation. Keep real CAD, real AI, Terse persistence, two sessions, and one coordinated design change. Agent Relay is optional and should not endanger those gates.

## Submission checklist

- Working URL and repository access configured as required by organizers.
- Short description, actual implementation boundaries, and Terse's role.
- Video of two sessions, a concurrent change, persistence, and export.
- Verify whether private repositories are accepted before changing visibility.
- Ask organizers whether the guaranteed interview can be used for Engram; the posted prize does not specify this.
