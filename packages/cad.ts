import * as cad from "replicad";
import type { Feature, Part } from "./protocol";
let sourceLoader: ((id: string) => string) | undefined;
export function setSourceLoader(loader: (id: string) => string) {
  sourceLoader = loader;
}

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
  } else if (f.kind === "sphere") {
    if (f.radius <= 0) throw new Error("Sphere radius must be positive");
    shape = cad.makeSphere(f.radius);
  } else if (f.kind === "polygon") {
    if (!f.points || f.points.length < 3 || f.size[2] <= 0)
      throw new Error("Polygon needs at least 3 XY points and positive depth");
    const pen = cad.draw(f.points[0]);
    for (const p of f.points.slice(1)) pen.lineTo(p);
    const solid = pen
      .close()
      .sketchOnPlane("XY")
      .extrude(f.size[2])
      .translateZ(-f.size[2] / 2);
    if (!cad.isShape3D(solid)) {
      solid.delete();
      throw new Error("Polygon extrusion did not create a solid");
    }
    shape = solid;
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
  let shape: cad.Shape3D;
  if (part.source) {
    if (!sourceLoader) throw new Error("CAD source loader not configured");
    const source = cad.deserializeShape(sourceLoader(part.source.assetId));
    if (!cad.isShape3D(source)) {
      source.delete();
      throw new Error("Imported source is not a solid");
    }
    shape = source;
  } else {
    if (!part.features.length || part.features[0].operation !== "add")
      throw new Error(
        "A part needs an imported source or an initial additive feature",
      );
    shape = primitive(part.features[0]);
  }
  try {
    for (const f of part.features.slice(part.source ? 0 : 1)) {
      const next = primitive(f);
      try {
        const result =
          f.operation === "add"
            ? shape.fuse(next)
            : f.operation === "cut"
              ? shape.cut(next)
              : shape.intersect(next);
        shape.delete();
        shape = result;
      } finally {
        next.delete();
      }
    }
    for (const operation of part.operations || []) {
      if (operation.type === "translate")
        shape = shape.translate(operation.vector);
      else if (operation.type === "rotate") {
        if (Math.hypot(...operation.axis) < 1e-9)
          throw new Error("Rotation axis must be nonzero");
        shape = shape.rotate(operation.angle, operation.origin, operation.axis);
      } else if (operation.type === "scale")
        shape = shape.scale(operation.factor, operation.origin);
      else if (operation.type === "boolean") {
        const tool = primitive(operation.feature);
        try {
          const result =
            operation.feature.operation === "add"
              ? shape.fuse(tool)
              : operation.feature.operation === "cut"
                ? shape.cut(tool)
                : shape.intersect(tool);
          shape.delete();
          shape = result;
        } finally {
          tool.delete();
        }
      } else if (operation.type === "fillet" || operation.type === "chamfer") {
        const edges = shape.edges;
        try {
          if (operation.edgeIndices.some((i) => i >= edges.length))
            throw new Error(
              "Edge index no longer exists; inspect the current body",
            );
          const filter = operation.edgeIndices.length
            ? (finder: cad.EdgeFinder) =>
                finder.inList(operation.edgeIndices.map((i) => edges[i]))
            : undefined;
          const result =
            operation.type === "fillet"
              ? shape.fillet(operation.radius, filter)
              : shape.chamfer(operation.radius, filter);
          shape.delete();
          shape = result;
        } finally {
          edges.forEach((e) => e.delete());
        }
      } else if (operation.type === "shell") {
        if (operation.thickness === 0)
          throw new Error("Shell thickness cannot be zero");
        const faces = shape.faces;
        try {
          if (operation.faceIndices.some((i) => i >= faces.length))
            throw new Error(
              "Face index no longer exists; inspect the current body",
            );
          const result = shape.shell(operation.thickness, (finder) =>
            finder.inList(operation.faceIndices.map((i) => faces[i])),
          );
          shape.delete();
          shape = result;
        } finally {
          faces.forEach((f) => f.delete());
        }
      } else if (operation.type === "clip") {
        if (Math.hypot(...operation.normal) < 1e-9)
          throw new Error("Clip normal must be nonzero");
        const plane = new cad.Plane(operation.origin, null, operation.normal);
        try {
          const result = shape.cutPlane(plane, 0, operation.keep);
          if (!result) throw new Error("Clip removed the whole body");
          shape.delete();
          shape = result;
        } finally {
          plane.delete();
        }
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

export function inspectPart(part: Part) {
  const shape = compilePart(part);
  const edges = shape.edges,
    faces = shape.faces;
  try {
    const properties = cad.measureShapeVolumeProperties(shape);
    const center = properties.centerOfMass;
    properties.delete();
    return {
      id: part.id,
      name: part.name,
      bounds: shape.boundingBox.bounds,
      volume: cad.measureVolume(shape),
      centerOfMass: center,
      edges: edges.map((edge, index) => {
        const start = edge.startPoint,
          end = edge.endPoint;
        try {
          return {
            index,
            type: edge.geomType,
            length: edge.length,
            start: start.toTuple(),
            end: end.toTuple(),
            bounds: edge.boundingBox.bounds,
          };
        } finally {
          start.delete();
          end.delete();
        }
      }),
      faces: faces.map((face, index) => {
        const center = face.center,
          normal = face.normalAt();
        try {
          return {
            index,
            type: face.geomType,
            center: center.toTuple(),
            normal: normal.toTuple(),
            bounds: face.boundingBox.bounds,
          };
        } finally {
          center.delete();
          normal.delete();
        }
      }),
    };
  } finally {
    edges.forEach((e) => e.delete());
    faces.forEach((f) => f.delete());
    shape.delete();
  }
}
export function measureBetween(parts: Part[]) {
  if (parts.length !== 2) throw new Error("Select exactly two bodies");
  const a = compilePart(parts[0]),
    b = compilePart(parts[1]),
    tool = new cad.DistanceTool();
  try {
    return {
      partIds: parts.map((p) => p.id),
      minimumDistance: tool.distanceBetween(a, b),
    };
  } finally {
    tool.delete();
    a.delete();
    b.delete();
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
