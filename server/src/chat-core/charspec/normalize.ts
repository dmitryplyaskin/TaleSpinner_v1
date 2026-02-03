import type { NormalizedCharSpec } from "./types";

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function asString(val: unknown): string {
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return "";
}

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map(asString).map((s) => s.trim()).filter((s) => s.length > 0);
}

function pickSource(root: Record<string, unknown>): {
  spec: string | null;
  spec_version: string | null;
} {
  const spec = typeof root.spec === "string" ? root.spec : null;
  const specVersion =
    typeof root.spec_version === "string"
      ? root.spec_version
      : typeof root.specVersion === "string"
      ? root.specVersion
      : null;
  return { spec, spec_version: specVersion };
}

function detectFormat(root: Record<string, unknown>): "v1" | "v2" | "v3" | "unknown" {
  const spec = typeof root.spec === "string" ? root.spec : "";
  if (spec === "chara_card_v3") return "v3";
  if (spec === "chara_card_v2") return "v2";

  const specVersion =
    typeof root.spec_version === "string"
      ? root.spec_version
      : typeof root.specVersion === "string"
      ? root.specVersion
      : "";
  if (specVersion.startsWith("3")) return "v3";
  if (specVersion.startsWith("2")) return "v2";

  // V1 is usually a flat object with required string fields.
  const hasV1Fields =
    typeof root.name === "string" &&
    typeof root.description === "string" &&
    typeof root.personality === "string" &&
    typeof root.scenario === "string" &&
    typeof root.first_mes === "string" &&
    typeof root.mes_example === "string";
  if (hasV1Fields) return "v1";

  // Sometimes V2/V3 may omit spec fields, but still have the `data.*` shape.
  if (isRecord(root.data)) {
    const d = root.data;
    if (
      typeof d.name === "string" ||
      typeof d.first_mes === "string" ||
      typeof d.description === "string"
    ) {
      // Without explicit version, treat as "v2" (same mapping for our normalized shape).
      return "v2";
    }
  }

  return "unknown";
}

export function normalizeCharSpec(input: unknown): NormalizedCharSpec {
  if (!isRecord(input)) {
    return {
      name: "",
      description: "",
      personality: "",
      scenario: "",
      first_mes: "",
      mes_example: "",
      alternate_greetings: [],
      tags: [],
      source: { spec: null, spec_version: null },
    };
  }

  const source = pickSource(input);
  const format = detectFormat(input);

  const base: NormalizedCharSpec = {
    name: "",
    description: "",
    personality: "",
    scenario: "",
    first_mes: "",
    mes_example: "",
    alternate_greetings: [],
    tags: [],
    source,
  };

  if (format === "v1") {
    const name = asString(input.name).trim();
    return {
      ...base,
      name,
      description: asString(input.description),
      personality: asString(input.personality),
      scenario: asString(input.scenario),
      first_mes: asString(input.first_mes),
      mes_example: asString(input.mes_example),
      source: { spec: source.spec ?? "chara_card_v1", spec_version: source.spec_version ?? "1.0" },
    };
  }

  if (format === "v2" || format === "v3") {
    const data = isRecord(input.data) ? input.data : ({} as Record<string, unknown>);

    const name = asString(data.name).trim();
    const normalized: NormalizedCharSpec = {
      ...base,
      name,
      description: asString(data.description),
      personality: asString(data.personality),
      scenario: asString(data.scenario),
      first_mes: asString(data.first_mes),
      mes_example: asString(data.mes_example),
      alternate_greetings: asStringArray(data.alternate_greetings),
      tags: asStringArray(data.tags),
      system_prompt:
        typeof data.system_prompt === "undefined" ? undefined : asString(data.system_prompt),
      post_history_instructions:
        typeof data.post_history_instructions === "undefined"
          ? undefined
          : asString(data.post_history_instructions),
      creator_notes:
        typeof data.creator_notes === "undefined" ? undefined : asString(data.creator_notes),
      creator: typeof data.creator === "undefined" ? undefined : asString(data.creator),
      character_version:
        typeof data.character_version === "undefined"
          ? undefined
          : asString(data.character_version),
      extensions: typeof data.extensions === "undefined" ? undefined : data.extensions,
      character_book:
        typeof data.character_book === "undefined" ? undefined : data.character_book,
      source: {
        spec: source.spec ?? (format === "v3" ? "chara_card_v3" : "chara_card_v2"),
        spec_version: source.spec_version ?? (format === "v3" ? "3.0" : "2.0"),
      },
    };

    // Some cards have a single greeting but no alternate greetings; keep array empty in that case.
    return normalized;
  }

  // Unknown shape; try best-effort using root-level fields (some exporters do that).
  return {
    ...base,
    name: asString(input.name).trim(),
    description: asString(input.description),
    personality: asString(input.personality),
    scenario: asString(input.scenario),
    first_mes: asString(input.first_mes),
    mes_example: asString(input.mes_example),
    alternate_greetings: asStringArray(input.alternate_greetings),
    tags: asStringArray(input.tags),
  };
}

