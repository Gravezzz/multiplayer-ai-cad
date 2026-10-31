# Sources checked October 31, 2026

## Event

[Haunted Hacks official event page](https://events.ycombinator.com/haunted-hacks-2026) was read through its rendered page because the static text fetch was empty.

- Hacking begins 11 a.m.; submission deadline is 4 p.m.; judging 4–5 p.m.
- All code must be created at the hackathon; advance ideation is allowed.
- Projects should ideally use Durable Actors or Agent Relay, with bonus credit for both. Terse alone fits the stated brief.
- Judging emphasizes execution or creative use cases; top entries demo live.
- Best overall receives a guaranteed YC interview. The page does not say whether it can be assigned to another startup such as Engram.
- Builderbase handles judging; participant signup occurs at check-in.

The user-provided prize screenshot corroborates the Terse and Agent Relay track distinction. Rules and eligibility for a specific submission remain the organizers' decision.

The user's venue photo of the judging slide adds: first-round judges review demo videos and project descriptions; eight finalists advance; finalists demo from their own laptops for two minutes. Five criteria are each scored 1–5: real-time AI and track technology; originality/creativity; execution/demo; user experience/design; potential impact. Treat the video and description as first-class deliverables, not optional extras.

## Terse

- [Overview](https://www.useterse.ai/): actor-local SQLite, serialized request handling, multiplayer/agent coordination positioning.
- [Quickstart](https://docs.useterse.ai/quickstart): currently shows Bun 1.4.2+, `terse-cli`, `terse-sdk/actor`, `terse actor dev`, generated clients, and Terse Cloud deployment.
- [Official repository](https://github.com/TerseAI/durable-actors): currently shows `durable-actors` imports and CLI, plus server-issued WebSocket grants. This differs from the quickstart.
- [Documentation index](https://docs.useterse.ai/llms.txt).

Do not mix the two API examples. Resolve package/CLI versions with the installed starter or the Terse team at the venue. Local inspection found Node and Git available; Bun was not on PATH. SDK behavior, atomic persistence boundaries, Windows support, deployed connection grants, and recovery must be verified before claiming them.

## CAD

- [Replicad overview](https://replicad.xyz/): JavaScript CAD library using OpenCascade, including STEP export and fillets.
- [Integration introduction](https://replicad.xyz/docs/intro/): links the official sample app and library integration documentation.
- [Source](https://github.com/sgenoud/replicad).

Selection: Replicad for the fastest plausible TypeScript/browser route to editable solid geometry. This is an architecture decision, not a completed integration benchmark. Check bundled OpenCascade licensing and notices before distribution.

## Open decisions needed for implementation

1. Working Terse project/account and deployment URL; keep credentials server-side.
2. Model provider credentials and a tested model/tool combination; avoid guessing deployment IDs.
3. Hosting that supports the CAD worker within memory/time limits.
4. Confirm interview transferability and any Builderbase-specific submission requirements with organizers.
