# Agent conversations

Click **Add agent**, give the agent a name, and send a message. Select an agent at the top of the panel to see only its conversation. Replies continue that conversation; each thread also keeps its own unsent draft while the page remains open. Names are labels, not fixed specialties.

The selector reports **Ready**, **Working**, **Needs reply**, **Changes saved**, **Replied**, or **Error**. Working agents show their current tool activity in their conversation. A completed response without a geometry commit says so explicitly. Historical runs without commit metadata show Replied, without inferring success from their wording.

The model explicitly chooses Needs reply through the `finish_turn` tool. No keyword or punctuation classification is used. The next message supplies this thread's saved user/assistant conversation and the new request to the model; the model must reread live geometry before editing. Other threads' conversations are not injected.

Terse persists threads, messages, and jobs. Its serialized `startJob` method admits one run per thread and at most four runs per room. Geometry commits retain the existing revision guard. Old jobs are preserved as conversations grouped by their recorded author identity. Existing CAD and revisions are not changed by this migration.

Limits: 30 threads per room, 200 messages per conversation. An explicit error asks the user to start another thread at the message limit. Model execution itself still does not resume after an API restart. Model credentials remain in server memory.

Checks: `npm test`, `npm run build`, and `npx tsc --noEmit -p actors/tsconfig.json`. Thread tests cover history isolation, duplicate terminal updates, legacy conversion, per-thread run admission, and explicit model question status.

Live verification on October 31: in `thread-ui-check-2026`, the configured model asked which finish to use and returned `needs_reply`. A second message in the same thread selected matte; the model confirmed it with `committed: false`. Both exchanges persisted after browser reload, the other agent stayed empty, and geometry revision remained zero. Browser checks also verified history/draft isolation and named-agent creation. Six automated tests, the production build, and actor typecheck passed.
