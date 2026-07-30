export const OPERATION_RESOURCE_LIMITS = {
  concurrentTasks: 4,
  operationsPerBlock: 64,
  operationsPerProfile: 128,
  blocksPerProfile: 16,
  dependenciesPerOperation: 32,
  runConditionsPerOperation: 32,
  exposuresPerArtifact: 16,
  artifactHistoryItems: 100,
  templateCharacters: 100_000,
  jsonSchemaBytes: 100_000,
  llmOutputBytes: 256 * 1024,
  artifactValueBytes: 256 * 1024,
  artifactHistoryBytes: 1024 * 1024,
} as const;

type ResourceLimitError = Error & { code: string };

function createResourceLimitError(code: string, message: string): ResourceLimitError {
  const error = new Error(message) as ResourceLimitError;
  error.code = code;
  return error;
}

export function serializedJsonByteLength(value: unknown): number {
  const serialized = JSON.stringify(value);
  return Buffer.byteLength(serialized ?? "null", "utf8");
}

export function assertArtifactValueWithinLimits(value: unknown): void {
  let bytes: number;
  try {
    bytes = serializedJsonByteLength(value);
  } catch {
    throw createResourceLimitError(
      "ARTIFACT_VALUE_NOT_SERIALIZABLE",
      "Artifact value must be JSON serializable"
    );
  }
  if (bytes > OPERATION_RESOURCE_LIMITS.artifactValueBytes) {
    throw createResourceLimitError(
      "ARTIFACT_VALUE_TOO_LARGE",
      `Artifact value exceeds ${OPERATION_RESOURCE_LIMITS.artifactValueBytes} bytes`
    );
  }
}

export function assertArtifactHistoryItemLimit(maxItems: number): void {
  if (
    !Number.isInteger(maxItems) ||
    maxItems < 1 ||
    maxItems > OPERATION_RESOURCE_LIMITS.artifactHistoryItems
  ) {
    throw createResourceLimitError(
      "ARTIFACT_HISTORY_LIMIT_INVALID",
      `Artifact history maxItems must be between 1 and ${OPERATION_RESOURCE_LIMITS.artifactHistoryItems}`
    );
  }
}

export function assertArtifactHistoryWithinLimits(history: unknown[]): void {
  if (serializedJsonByteLength(history) > OPERATION_RESOURCE_LIMITS.artifactHistoryBytes) {
    throw createResourceLimitError(
      "ARTIFACT_HISTORY_TOO_LARGE",
      `Artifact history exceeds ${OPERATION_RESOURCE_LIMITS.artifactHistoryBytes} bytes`
    );
  }
}
