import { Resvg, initWasm } from "@resvg/resvg-wasm";
import fs from "node:fs";
import { createRequire } from "node:module";
import type { Part } from "../packages/protocol";
import { meshParts } from "../packages/cad";
const require = createRequire(import.meta.url);
await initWasm(
  fs.readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm")),
);
type V = [number, number, number];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (v: V): V => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l) as V;
};
export function renderParts(
  parts: Part[],
  view: "isometric" | "front" | "side" | "top" = "isometric",
) {
  if (!parts.length) throw new Error("No editable geometry to render");
  const direction: V =
    view === "front"
      ? [0, -1, 0]
      : view === "side"
        ? [1, 0, 0]
        : view === "top"
          ? [0, 0, 1]
          : norm([1, -1, 0.8]);
  const up: V = view === "top" ? [0, 1, 0] : [0, 0, 1],
    right = norm(cross(up, direction)),
    vertical = norm(cross(direction, right));
  const meshes = meshParts(parts),
    triangles: { points: number[][]; depth: number; color: string }[] = [];
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  meshes.forEach((mesh, m) => {
    const vertices: V[] = [];
    for (let i = 0; i < mesh.vertices.length; i += 3)
      vertices.push(mesh.vertices.slice(i, i + 3) as V);
    const projected = vertices.map((v) => {
      const p = [dot(v, right), -dot(v, vertical), dot(v, direction)];
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
      return p;
    });
    const rgb = [1, 3, 5].map((i) =>
      parseInt(parts[m].color.slice(i, i + 2), 16),
    );
    for (let i = 0; i < mesh.triangles.length; i += 3) {
      const ids = mesh.triangles.slice(i, i + 3),
        [a, b, c] = ids.map((j) => vertices[j]);
      const normal = cross(
        b.map((v, k) => v - a[k]) as V,
        c.map((v, k) => v - a[k]) as V,
      );
      if (Math.hypot(...normal) < 1e-12) continue;
      const shade =
        0.5 + 0.5 * Math.abs(dot(norm(normal), norm([0.4, -0.6, 0.8])));
      triangles.push({
        points: ids.map((j) => projected[j]),
        depth: ids.reduce((s, j) => s + projected[j][2], 0) / 3,
        color: `rgb(${rgb.map((v) => Math.round(v * shade)).join(",")})`,
      });
    }
  });
  const size = 768,
    pad = 45,
    scale = Math.min(
      (size - pad * 2) / (maxX - minX || 1),
      (size - pad * 2) / (maxY - minY || 1),
    );
  const cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  triangles.sort((a, b) => a.depth - b.depth);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#f0f2ec"/>${triangles.map((t) => `<path d="M${t.points.map((p) => `${((p[0] - cx) * scale + size / 2).toFixed(2)},${((p[1] - cy) * scale + size / 2).toFixed(2)}`).join(" L")} Z" fill="${t.color}" stroke="${t.color}" stroke-width="0.4"/>`).join("")}</svg>`;
  const renderer = new Resvg(svg),
    rendered = renderer.render();
  try {
    return {
      image: `data:image/png;base64,${Buffer.from(rendered.asPng()).toString("base64")}`,
      view,
      partIds: parts.map((p) => p.id),
      measurements: meshes.map((m) => ({
        id: m.id,
        bounds: m.bounds,
        volume: m.volume,
      })),
    };
  } finally {
    rendered.free();
    renderer.free();
  }
}
