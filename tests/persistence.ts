import { startLocalActors } from "terse-sdk/dev";
import { createActorTransport } from "durable-actors/backend";
import path from "node:path";
import assert from "node:assert/strict";
const room = `persistence-${crypto.randomUUID()}`;
const options = {
  entrypoint: path.resolve("actors/project.ts"),
  project: process.cwd(),
  dataDir: ".terse-persistence-test",
  port: 7210,
  quiet: true,
};
let runtime = await startLocalActors(options);
let transport = createActorTransport({
  controlPlaneUrl: runtime.connection.controlPlaneUrl,
  projectId: runtime.connection.projectId,
  apiKey: runtime.connection.apiKey,
});
try {
  await transport.invoke("ProjectActor", room, "commit", [
    JSON.stringify({
      baseRevision: 0,
      summary: "Persistence integration marker",
      upsertParts: [],
      removePartIds: [],
    }),
    "test",
    crypto.randomUUID(),
  ]);
} finally {
  await runtime.stop();
}
runtime = await startLocalActors(options);
transport = createActorTransport({
  controlPlaneUrl: runtime.connection.controlPlaneUrl,
  projectId: runtime.connection.projectId,
  apiKey: runtime.connection.apiKey,
});
try {
  const result: any = await transport.invoke(
    "ProjectActor",
    room,
    "snapshot",
    [],
  );
  assert.equal(result.revision, 1);
  assert.equal(result.history[0].text, "Persistence integration marker");
  console.log(
    JSON.stringify({
      actorProcessRestartRestored: true,
      revision: result.revision,
    }),
  );
} finally {
  await runtime.stop();
}
