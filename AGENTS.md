# Engineering instructions

Build this project during the hackathon; do not copy application code from Engram or Kortyx.

Use real model calls for design intent, task decomposition, and semantic conflict resolution. No keyword heuristics, scripted prompt-to-design mappings, fake agent activity, or deterministic fallbacks masquerading as AI behavior.

Explicit geometry operations, schema checks, revision guards, authorization, and mathematical validation are infrastructure, not substitutes for model reasoning. Return failures and validation evidence to the model; if repair fails, show the failure and retain the last accepted revision.

Use Terse Durable Actors for authoritative collaboration and persistence. Do not silently substitute an in-memory backend.

Do not claim a CAD constraint, manufacturing property, persistence guarantee, or completed action without verifying it. Keep credentials out of browser bundles and Git. Prefer completing the narrow end-to-end demonstration over adding features.
