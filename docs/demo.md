# Assembly: two-minute demo

- **Opening link:** http://127.0.0.1:5173/
- **Import:** `examples/wearable/original.step`
- **Prompts:** [copy-ready design brief](demo-prompts.md)
- **Reviewed result:** `examples/wearable/refined.step`

Record the actual workflow at full length, then edit it to 1:55–1:59. Use a visible **“Generation time shortened”** caption wherever waiting is cut. Never substitute a previous result as the output of a new run. If showing the saved result, label it **“Earlier completed run.”** Model latency and geometry quality vary; two minutes is the video length, not a promised end-to-end generation time.

## Shot list and spoken script

| Time | Show / do | Say |
|---|---|---|
| 0:00–0:14 | Face camera, holding or wearing the original prototype. | “Hi, I'm Dima. I work in CAD every day building wearable hardware. One AI conversation makes me queue independent edits. Hardware teams work in parallel. Why shouldn't our AI teammates?” |
| 0:14–0:24 | Switch to the lobby. Name a new room **Wearable evolution** and create it. | “This is Assembly: a shared CAD workspace for humans and AI agents. Start a room, or join an existing design.” |
| 0:24–0:35 | Import `original.step`; orbit briefly so its rear band is visible. | “This is my actual prototype, imported as eight editable STEP solids. These are real CAD bodies, not a generated picture.” |
| 0:35–0:51 | Add **Band** and **Electrode** agents. Paste the prompts and send both. Keep both Working badges visible. | “I'll give one teammate the overhead band and another the under-chin electrode support. Each has its own conversation, and both work on the same assembly.” |
| 0:51–1:17 | Show progress, briefly switch threads, and show Activity. Optional second browser window on the same room. | “Terse gives each room a Durable Actor. It stores the assembly, revision history, and conversations. The models think in parallel outside it. OpenCascade validates their geometry, then the actor serializes accepted edits. If a proposal is out of date, it is rejected and sent back to the model to revise.” |
| 1:17–1:34 | Show the actual accepted result. Orbit close to the band and contact. Visibly cut waiting if needed. | “Both edits are now in the shared design. The existing modules remain, and the new support is a separate editable solid. I can keep refining either thread without losing the other teammate's work.” |
| 1:34–1:47 | Send the short follow-up from the prompt sheet. Show its response; show the second browser updating if available. | “A follow-up stays with the same agent. Humans use the same shared edit path, and every connected view receives accepted changes.” |
| 1:47–1:58 | Click Export STEP. End on the refined model and repository URL. | “Our starting point is small hardware teams iterating wearables, enclosures, and fixtures. Assembly turns one-at-a-time AI CAD into a shared workspace for parallel design, with durable state and real STEP output.” |

Speak naturally and trim pauses before speeding up speech. Do not spend the opening explaining every control. The model's rendered preview is internal to its tools; the viewport shows accepted edits.

## Before recording

1. Confirm the API and frontend are running. Reconnect the model key after a backend restart. Close settings before capturing.
2. Open the lobby, prompt sheet, and STEP file location. Keep two browser windows ready if showing collaboration. Those are two actual sessions, not two different people.
3. Use a **new room for the take**, import once, and keep both optional STL overlays off. **Reset orbit resets the camera. Undo reverses geometry and can remove an import.**
4. Use the same room URL in both windows. Accepted changes are shared; camera and selected agent are local.
5. Rehearse the exact prompts. If the result has detached geometry or ugly proportions, refine it and show that honestly.
6. Keep the polished existing room intact. Retain the full recording before cutting the submission version.

## If inference runs long

For the recorded submission, remove idle time and label the cut. For an unedited finalist demo, start agents early and explain architecture during inference. If necessary show the saved **earlier run**, identified as such. A conflict is timing-dependent: show one only if Activity actually records it.

## Technical answers for judges

**Is every component a Durable Actor?** No. One `ProjectActor` per room owns parts, revisions, jobs, conversations, and undo. A separate `RoomDirectory` actor stores lobby room names. Components are CAD records. AI teammates are concurrent model/tool loops, not separate Terse actors.

**Where is the concurrency?** Model calls and geometry processing happen outside the short actor commit handler. The actor serializes accepted updates. The guard is room-wide, so even disjoint edits can become stale. A real earlier test recorded a stale proposal, model reread, and preservation of both edits; see [evidence](verified-live-runs.json).

**Does Terse solve mechanical conflicts?** No. It provides state and serialized execution. Application revision guards detect stale proposals; models reason about updated geometry. OpenCascade checks solid construction. Attachment and ergonomics still need engineering review.

**What is durable?** Room metadata, design records, conversations, job status, and undo. Imported BReps live in a local asset directory. In-flight model execution does not resume automatically after an API restart.

**Is this hosted?** The demonstration runs locally with multiple browser sessions on the laptop. The repository is public; a hosted multi-user service is future work.

**Is collaborative CAD new?** Human simultaneous editing is established, including [Onshape's documented collaboration](https://cad.onshape.com/help/Content/Collaboration/sharing_and_collaboration.htm). Our focus is parallel AI teammates, ongoing conversations, and shared, validated CAD edits.

## Judging priorities

The five equally weighted criteria are real-time AI / track technology, originality, execution, UX, and potential impact. Show two Working agents, a parallel-work use case, actual STEP changes/export, room/thread UI, and a focused hardware-team wedge. Avoid claiming measured time savings, manufacturing readiness, or novelty of human CAD collaboration.
