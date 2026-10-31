import test from "node:test";
import assert from "node:assert/strict";
import {
  initialProject,
  startThreadJob,
  updateThreadJob,
  projectThreads,
} from "../packages/protocol";
import type { Job } from "../packages/protocol";
import { runAgent, type AgentServices } from "../server/agents";

const job = (id: string, threadId = "a"): Job => ({
  id,
  threadId,
  author: "Same name",
  task: "Change this",
  status: "running",
  message: "Working",
});
test("threads isolate conversations even when names match and serialize runs per thread", () => {
  let state = {
    ...initialProject(),
    threads: [
      { id: "a", name: "Same name", messages: [] },
      { id: "b", name: "Same name", messages: [] },
    ],
  };
  let running = startThreadJob(state, job("one"));
  assert.throws(() => startThreadJob(running, job("two")), /still working/);
  running = startThreadJob(running, job("other", "b"));
  const waiting = updateThreadJob(running, {
    ...job("one"),
    status: "needs_reply",
    message: "Which side?",
  });
  const resumed = startThreadJob(waiting, { ...job("two"), task: "Left side" });
  assert.deepEqual(
    resumed.threads![0].messages.map((m) => m.text),
    ["Change this", "Which side?", "Left side"],
  );
  assert.deepEqual(
    resumed.threads![1].messages.map((m) => m.text),
    ["Change this"],
  );
  assert.equal(resumed.revision, 0);
  assert.equal(
    updateThreadJob(waiting, {
      ...job("one"),
      status: "needs_reply",
      message: "Which side?",
    }).threads![0].messages.length,
    2,
  );
});
test("legacy migration preserves user and assistant messages without guessing question status", () => {
  const state = {
    ...initialProject(),
    jobs: [
      {
        ...job("old"),
        threadId: undefined,
        status: "complete" as const,
        message: "Which side?",
      },
    ],
  };
  const threads = projectThreads(state);
  assert.equal(threads.length, 1);
  assert.equal(threads[0].messages.length, 2);
  assert.deepEqual(projectThreads({ ...state, threads }), threads);
  assert.equal(state.jobs[0].status, "complete");
});
test("model receives selected history and explicitly requests a reply without a geometry commit", async () => {
  const originalFetch = globalThis.fetch;
  const jobs: Job[] = [];
  let request: any;
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(init!.body as string);
    return Response.json({
      output: [
        {
          type: "function_call",
          name: "finish_turn",
          call_id: "f1",
          arguments: JSON.stringify({
            status: "needs_reply",
            message: "Which mounting face?",
          }),
        },
      ],
    });
  };
  try {
    const unexpected = async (): Promise<never> => { throw new Error("Unexpected CAD call in conversation-only test"); };
    const services: AgentServices = {
      snapshot: unexpected, measure: unexpected, inspect: unexpected, render: unexpected,
      distance: unexpected, preview: unexpected, commit: unexpected,
      job: async (j: Job) => {
        jobs.push(j);
      },
      activity: async () => {},
    };
    await runAgent(
      "Use the left side",
      "Agent 1",
      "job",
      {
        apiKey: "test-only",
        model: "test-only",
        baseUrl: "https://test.invalid",
      },
      services,
      [
        { id: "u", role: "user", text: "Refine the support" },
        { id: "a", role: "assistant", text: "Which side?" },
      ],
      "thread",
    );
    assert.deepEqual(request.input.slice(0, 2), [
      { role: "user", content: "Refine the support" },
      { role: "assistant", content: "Which side?" },
    ]);
    assert.equal(request.input[2].content[0].text, "Use the left side");
    assert.equal(request.tool_choice, "required");
    assert.equal(jobs.at(-1)!.status, "needs_reply");
    assert.equal(jobs.at(-1)!.threadId, "thread");
    assert.equal(jobs.at(-1)!.committed, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
