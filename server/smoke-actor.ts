import { connectActors } from "./runtime";
const { invoke, runtime } = await connectActors();
try {
  console.log(JSON.stringify(await invoke("smoke", "snapshot")));
} finally {
  await runtime.stop();
}
