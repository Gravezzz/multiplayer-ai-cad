import { startLocalActors } from "terse-sdk/dev";
import { createActorTransport } from "durable-actors/backend";
import path from "node:path";
import type { Project } from "../packages/protocol";

export async function connectActors() {
  const runtime = await startLocalActors({
    entrypoint: path.resolve("actors/project.ts"),
    project: process.cwd(),
    dataDir: ".terse",
    port: 7100,
  });
  const transport = createActorTransport({
    controlPlaneUrl: runtime.connection.controlPlaneUrl,
    projectId: runtime.connection.projectId,
    apiKey: runtime.connection.apiKey,
  });
  const invoke = async (room: string, method: string, args: unknown[] = []) =>
    transport.invoke("ProjectActor", room, method, args) as Promise<Project>;
  return { invoke, runtime };
}
