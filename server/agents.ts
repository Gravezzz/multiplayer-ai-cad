import { z } from "zod";
import fs from "node:fs";
import { editSchema, geometryHelp } from "../packages/protocol";
import type { Project, Job, Edit } from "../packages/protocol";
export type ModelConfig = { apiKey: string; baseUrl: string; model: string };
export type AgentServices = {
  snapshot: () => Promise<Project>;
  measure: () => Promise<unknown>;
  commit: (edit: Edit, author: string) => Promise<Project>;
  job: (job: Job) => Promise<void>;
  activity: (
    author: string,
    text: string,
    kind: "agent" | "error" | "conflict",
  ) => Promise<void>;
};

export async function runAgent(
  task: string,
  author: string,
  id: string,
  config: ModelConfig,
  services: AgentServices,
) {
  const status = async (message: string, state: Job["status"] = "running") =>
    services.job({ id, author, task, status: state, message });
  const targetImage = fs
    .readFileSync("public/references/target.png")
    .toString("base64");
  const input: any[] = [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: `${task}\nThe attached image is the user's target concept, not a required exact copy. The under-chin electrode should have visibly distinct contact elements. Follow the task rather than recreating every visible component.`,
        },
        {
          type: "input_image",
          image_url: `data:image/png;base64,${targetImage}`,
        },
      ],
    },
  ];
  const schema = z.toJSONSchema(editSchema);
  delete (schema as any).$schema;
  const tools = [
    {
      type: "function",
      name: "read_assembly",
      description:
        "Read current revision, all editable part feature specifications, recent shared activity, and coordinate guidance.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: "function",
      name: "measure_assembly",
      description:
        "Get kernel-computed bounding boxes and volume of current editable solids. Bounds do not prove collision-free fit or anatomical suitability.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: "function",
      name: "commit_design",
      description:
        "Compile and validate a targeted geometry edit, then atomically commit only if baseRevision is still current. On stale revision or geometry error, inspect the error and repair the design. Never claim success until this tool returns success.",
      parameters: schema,
      strict: false,
    },
  ];
  let committed = false;
  try {
    await status("Reading the shared design");
    for (let turn = 0; turn < 10; turn++) {
      const response = await fetch(
        `${config.baseUrl.replace(/\/$/, "")}/responses`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            store: false,
            include: ["reasoning.encrypted_content"],
            instructions: `You are ${author}, an expert mechanical CAD teammate in a live shared design workspace. Use the tools to implement the user's requested geometric changes. First read the assembly. Other humans and agents are editing concurrently. Preserve unrelated parts and respect current dimensions; stale proposals must be revised against latest state, not blindly resubmitted. Work efficiently, generally one cohesive commit per task. Explain briefly what changed and remaining limitations. Do not claim manufacture-ready or electrical/medical validation. If the user asks to upgrade the wearable, create the required editable replacement components; the imported STL remains a separately toggleable reference. No UI operation is needed. ${geometryHelp} The old reference is centered in the viewport: approximate overall bounds X +/-89, Y +/-94, Z +/-48 mm, not an anatomical measurement. Use explicit design dimensions and state assumptions. Over-head band typical concept radius 85 mm, thickness 3 mm, width 16 mm; these are starting design context, not forced output. User instructions take precedence. Avoid too many tiny features. If you need anatomical fit dimensions ask instead of claiming fit.`,
            input,
            tools,
            parallel_tool_calls: false,
            max_output_tokens: 5000,
          }),
          signal: AbortSignal.timeout(120_000),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          `Model request ${response.status}: ${payload.error?.message || response.statusText}`,
        );
      }
      const result = await response.json();
      if (result.error) throw new Error(result.error.message);
      if (result.status === "incomplete")
        throw new Error(
          `Model response incomplete: ${result.incomplete_details?.reason || "unknown"}`,
        );
      const output = result.output || [];
      input.push(...output);
      const calls = output.filter((item: any) => item.type === "function_call");
      const text = output
        .filter((item: any) => item.type === "message")
        .flatMap((item: any) => item.content || [])
        .filter((item: any) => item.type === "output_text")
        .map((item: any) => item.text)
        .join("\n");
      if (!calls.length) {
        if (text) await services.activity(author, text, "agent");
        await status(
          text ||
            (committed
              ? "Design committed"
              : "Agent finished without changing geometry"),
          "complete",
        );
        return;
      }
      for (const call of calls) {
        let result: unknown;
        try {
          if (call.name === "read_assembly") {
            await status("Inspecting current parts and revisions");
            const snapshot = await services.snapshot();
            result = {
              ...snapshot,
              history: snapshot.history.slice(-15),
              requests: undefined,
              geometryHelp,
            };
          } else if (call.name === "measure_assembly") {
            await status("Measuring accepted geometry");
            result = await services.measure();
          } else if (call.name === "commit_design") {
            const edit = editSchema.parse(JSON.parse(call.arguments));
            await status(`Validating: ${edit.summary}`);
            const state = await services.commit(edit, author);
            committed = true;
            result = {
              success: true,
              revision: state.revision,
              parts: state.parts,
            };
            await status("Design committed; checking completion");
          } else throw new Error(`Unknown tool ${call.name}`);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          result = { success: false, error: message };
          await services.activity(
            author,
            message,
            message.includes("STALE_REVISION") ? "conflict" : "error",
          );
          await status("Revising proposal from tool feedback");
        }
        input.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result),
        });
      }
    }
    throw new Error(
      "Agent reached the 10-step tool budget. Review the accepted design and continue with a narrower request.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await status(message, "error");
    await services.activity(author, message, "error");
  }
}
