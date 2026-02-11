import { z } from "zod";

const SUPPORTED_DESCRIPTOR_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "null",
  "integer",
  "int",
  "object",
  "array",
  "unknown",
  "any",
]);

function formatPath(path: string[]): string {
  if (path.length === 0) return "$";
  return `$.${path.join(".")}`;
}

function parseDescriptor(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const typePart = trimmed.split(":", 1)[0]?.trim().toLowerCase() ?? "";
  if (!SUPPORTED_DESCRIPTOR_TYPES.has(typePart)) return null;
  return typePart;
}

function schemaFromDescriptorType(typeName: string): z.ZodTypeAny {
  switch (typeName) {
    case "string":
      return z.string();
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    case "null":
      return z.null();
    case "integer":
    case "int":
      return z.number().int();
    case "object":
      return z.object({}).strict();
    case "array":
      return z.array(z.unknown());
    case "unknown":
    case "any":
      return z.unknown();
    default:
      return z.unknown();
  }
}

function inferSchemaFromLiteral(value: unknown, path: string[]): z.ZodTypeAny {
  if (typeof value === "number") return z.number();
  if (typeof value === "boolean") return z.boolean();
  if (value === null) return z.null();

  if (Array.isArray(value)) {
    if (value.length === 0) return z.array(z.unknown());
    const itemSchemas = value.map((item, idx) => buildSchemaFromSpec(item, [...path, `[${idx}]`]));
    if (itemSchemas.length === 1) return z.array(itemSchemas[0]);
    return z.array(z.union(itemSchemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]));
  }

  if (value && typeof value === "object") {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [rawKey, childSpec] of Object.entries(value as Record<string, unknown>)) {
      const optional = rawKey.endsWith("?");
      const baseKey = optional ? rawKey.slice(0, -1).trim() : rawKey.trim();
      if (baseKey.length === 0) {
        throw new Error(`Invalid key "${rawKey}" at ${formatPath(path)}: key name cannot be empty`);
      }
      const childSchema = buildSchemaFromSpec(childSpec, [...path, baseKey]);
      shape[baseKey] = optional ? childSchema.optional() : childSchema;
    }
    return z.object(shape).strict();
  }

  if (typeof value === "string") {
    const descriptorType = parseDescriptor(value);
    if (!descriptorType) {
      throw new Error(
        `Invalid descriptor "${value}" at ${formatPath(path)}. Use "type: description", e.g. "string: title"`
      );
    }
    return schemaFromDescriptorType(descriptorType);
  }

  throw new Error(`Unsupported schema value at ${formatPath(path)}: ${String(value)}`);
}

export function buildSchemaFromSpec(spec: unknown, path: string[] = []): z.ZodTypeAny {
  return inferSchemaFromLiteral(spec, path);
}

export function compileLlmJsonSchemaSpec(spec: unknown): z.ZodTypeAny {
  return buildSchemaFromSpec(spec);
}

export function validateJsonBySchemaSpec(params: {
  value: unknown;
  schemaSpec: unknown;
}) {
  const schema = compileLlmJsonSchemaSpec(params.schemaSpec);
  return schema.safeParse(params.value);
}
