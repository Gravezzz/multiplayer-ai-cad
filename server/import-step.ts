import { getOC, cast, measureVolume } from "replicad";
import { randomUUID } from "node:crypto";
import { saveBrep } from "./assets";
import type { Part } from "../packages/protocol";

// Parse the name of an explicitly declared STEP solid. This is metadata parsing,
// not geometry classification. A name is assigned only after exact TShape identity matches.
export function importStep(text: string, fileName: string) {
  if (!text.includes("ISO-10303-21;"))
    throw new Error("Expected an ISO STEP file");
  const oc = getOC(),
    file = `/import-${randomUUID()}.step`,
    reader = new oc.STEPControl_Reader();
  oc.FS.writeFile(file, text);
  let root: ReturnType<typeof cast> | undefined;
  try {
    const status = reader.ReadFile(file);
    if (status !== oc.IFSelect_ReturnStatus.IFSelect_RetDone)
      throw new Error("OpenCascade could not read this STEP file");
    reader.TransferRoots();
    root = cast(reader.OneShape());
    const solids = root.solids;
    if (!solids.length) throw new Error("STEP contains no solid bodies");
    if (solids.length > 100)
      throw new Error("Import limit is 100 solid bodies");
    const bodyNames = new Map<number, string>();
    const declaredNames = new Map(
      [
        ...text.matchAll(
          /#(\d+)\s*=\s*MANIFOLD_SOLID_BREP\s*\(\s*'((?:[^']|'')*)'/g,
        ),
      ].map((m) => [Number(m[1]), m[2].replace(/''/g, "'")]),
    );
    const model = reader.StepModel();
    try {
      for (let i = 1; i <= model.NbEntities(); i++) {
        const entity = model.Entity(i);
        try {
          const label = model.IdentLabel(entity),
            name = declaredNames.get(label);
          if (name) {
            reader.ClearShapes();
            if (reader.TransferEntity(entity)) {
              const candidate = cast(reader.OneShape());
              try {
                solids.forEach((s, index) => {
                  if (s.wrapped.IsPartner(candidate.wrapped))
                    bodyNames.set(index, name);
                });
              } finally {
                candidate.delete();
              }
            }
          }
        } finally {
          entity.delete();
        }
      }
    } finally {
      model.delete();
    }
    const bounds = root.boundingBox.bounds;
    const center = bounds[0].map((v, i) => (v + bounds[1][i]) / 2) as [
      number,
      number,
      number,
    ];
    const parts: Part[] = [];
    try {
      solids.forEach((solid, index) => {
        const name = bodyNames.get(index) || `Imported body ${index + 1}`;
        const translated = solid
          .clone()
          .translate(center.map((v) => -v) as [number, number, number]);
        try {
          if (measureVolume(translated) <= 0)
            throw new Error(`Body ${index + 1} has no positive volume`);
          const assetId = saveBrep(translated.serialize());
          parts.push({
            id: `body-${randomUUID().slice(0, 8)}`,
            name,
            color: "#79928a",
            source: { assetId, fileName, bodyName: name, bodyIndex: index },
            features: [],
            operations: [],
          });
        } finally {
          translated.delete();
        }
      });
    } finally {
      solids.forEach((s) => s.delete());
    }
    return {
      parts,
      sourceBounds: bounds,
      translation: center.map((v) => -v),
      matchedNames: bodyNames.size,
      bodyCount: parts.length,
    };
  } finally {
    root?.delete();
    reader.delete();
    oc.FS.unlink(file);
  }
}
