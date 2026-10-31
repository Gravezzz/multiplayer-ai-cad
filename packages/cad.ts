import * as cad from "replicad";
import type { Feature, Part } from "./protocol";

function primitive(f: Feature): cad.Shape3D {
  let shape: cad.Shape3D;
  if (f.kind === "box") {
    if (f.size.some((n) => n <= 0 || n > 500))
      throw new Error("Box dimensions must be 0–500 mm");
    shape = cad.makeBox(
      f.size.map((n) => -n / 2) as [number, number, number],
      f.size.map((n) => n / 2) as [number, number, number],
    );
  } else if (f.kind === "cylinder") {
    if (f.radius <= 0 || f.size[2] <= 0 || f.size[2] > 500)
      throw new Error(
        "Cylinder radius and height must be positive, height at most 500 mm",
      );
    shape = cad.makeCylinder(f.radius, f.size[2], [0, 0, -f.size[2] / 2]);
  } else {
    const span = f.endAngle - f.startAngle;
    if (
      f.radius <= f.thickness ||
      f.thickness <= 0 ||
      f.size[2] <= 0 ||
      f.size[2] > 100 ||
      span <= 0 ||
      span > 180
    )
      throw new Error(
        "Arc needs radius > thickness > 0, depth 0–100 mm, angle span 0–180 degrees",
      );
    const point = (radius: number, angle: number): [number, number] => [
      radius * Math.cos((angle * Math.PI) / 180),
      radius * Math.sin((angle * Math.PI) / 180),
    ];
    const inner = f.radius - f.thickness,
      mid = (f.startAngle + f.endAngle) / 2;
    const arc = cad
      .draw(point(f.radius, f.startAngle))
      .threePointsArcTo(point(f.radius, f.endAngle), point(f.radius, mid))
      .lineTo(point(inner, f.endAngle))
      .threePointsArcTo(point(inner, f.startAngle), point(inner, mid))
      .close()
      .sketchOnPlane("XY")
      .extrude(f.size[2])
      .translateZ(-f.size[2] / 2);
    if (!cad.isShape3D(arc)) {
      arc.delete();
      throw new Error("Arc did not produce a solid");
    }
    shape = arc;
  }
  f.rotation.forEach((angle, i) => {
    if (angle)
      shape = shape.rotate(
        angle,
        [0, 0, 0],
        i === 0 ? [1, 0, 0] : i === 1 ? [0, 1, 0] : [0, 0, 1],
      );
  });
  shape = shape.translate(f.position);
  return shape;
}

export function compilePart(part: Part): cad.Shape3D {
  if (part.features[0].operation !== "add")
    throw new Error("First feature must add a solid");
  let shape = primitive(part.features[0]);
  try {
    for (const f of part.features.slice(1)) {
      const next = primitive(f);
      try {
        const result =
          f.operation === "add" ? shape.fuse(next) : shape.cut(next);
        shape.delete();
        shape = result;
      } finally {
        next.delete();
      }
    }
    const volume = cad.measureVolume(shape);
    if (!Number.isFinite(volume) || volume <= 0)
      throw new Error(`Part ${part.name} has no positive volume`);
    const solids = shape.solids;
    const count = solids.length;
    solids.forEach((s) => s.delete());
    if (count !== 1)
      throw new Error(
        `Part ${part.name} contains disconnected solids; use separate part IDs`,
      );
    return shape;
  } catch (e) {
    shape.delete();
    throw e;
  }
}

export function meshParts(parts: Part[]) {
  return parts.map((part) => {
    const shape = compilePart(part);
    try {
      return {
        id: part.id,
        ...shape.mesh({ tolerance: 0.15, angularTolerance: 0.15 }),
        volume: cad.measureVolume(shape),
        bounds: shape.boundingBox.bounds,
      };
    } finally {
      shape.delete();
    }
  });
}

export function stepParts(parts: Part[]): Blob {
  const shapes = parts.map((part) => ({
    shape: compilePart(part),
    name: part.name,
    color: part.color,
  }));
  try {
    return cad.exportSTEP(shapes);
  } finally {
    shapes.forEach((s) => s.shape.delete());
  }
}
