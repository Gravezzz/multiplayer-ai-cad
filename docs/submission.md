# Submission copy and checklist

## Project name

Assembly

## One-liner

Assembly is a multiplayer CAD workspace where humans and AI agents design and refine real 3D parts together in real time.

## Short description

Hardware design involves connected parts and parallel work. Assembly brings that workflow to AI CAD: import an existing STEP assembly, create multiple AI teammates, and keep editing while they work. Each teammate has its own persistent conversation and can inspect, measure, render, preview, and modify real solid geometry.

Terse Durable Actors own the shared room state. Models reason concurrently; OpenCascade validates geometry; revision-guarded actor commits prevent stale proposals from overwriting newer work. Changes appear in every connected browser, and the accepted assembly exports to STEP.

The demo transforms a real wearable prototype into an overhead design and adds a refined under-chin electrode support. The initial customer hypothesis is small hardware teams iterating housings, mounts, wearables, and fixtures. This is a local direct-solid CAD MVP; public hosting and a full assembly constraint system are outside the current scope.

## Track technology

Terse Durable Actors: one authoritative ProjectActor per room; RoomDirectory for the lobby. Durable design records, revisions, conversations, job status, and undo. Concurrent model/tool execution happens outside the actor. The application performs CAD validation and stale-revision checks; models handle semantic repair. Browser updates use application-server SSE. Agent Relay is not used.

## Required items

- [ ] YouTube demo link, **two minutes maximum**. Verify the uploaded video plays while signed out. An unlisted link is suitable only if the submission form accepts it.
- [ ] Public GitHub URL: https://github.com/Gravezzz/multiplayer-ai-cad
- [x] One-liner entered in the supplied submission screenshot; copy above matches it.
- [ ] Save/submit the form and verify confirmation before **4:00 p.m. Pacific, October 31, 2026**.

Costume photo is optional. No video upload, submission, or receipt is implied by this document.

## Assets

- [Timed script](demo.md)
- [Prompts](demo-prompts.md)
- [Original and refined STEP example](../examples/wearable/README.md)
- [Architecture](architecture.md)
- [Recorded conflict evidence](verified-live-runs.json)

## Claims to keep precise

- Human simultaneous CAD editing exists; Assembly focuses on parallel AI teammates.
- Lobby counts are actual browser sessions, not authenticated unique people.
- Models can ask questions, fail, or need refinement. No scripted design fallback is substituted.
- Valid solids do not establish anatomical fit, electrical performance, safe skin contact, or manufacturability.
- Input hardware predates the hackathon. The Assembly application was built during the event.
