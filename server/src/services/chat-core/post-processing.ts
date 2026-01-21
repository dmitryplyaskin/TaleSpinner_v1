import { getMessageVariantById } from "./message-variants-repository";
import { updateAssistantBlocks } from "./chats-repository";
import {
  getLatestPersistedArtifact,
  writePersistedArtifact,
  type PipelineArtifactContentType,
  type PipelineArtifactVisibility,
} from "./pipeline-artifacts-repository";

type BlocksModeV1 = "single_markdown" | "extract_json_fence";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type PipelineProfileSpecV1 = {
  spec_version: 1;
  pipelines: Array<{
    id: string;
    name?: string;
    enabled: boolean;
    steps: Array<{
      id?: string;
      stepName: string;
      stepType: string;
      enabled: boolean;
      params: Record<string, unknown>;
    }>;
  }>;
};

function parseProfileSpecV1(spec: unknown): PipelineProfileSpecV1 | null {
  if (!isRecord(spec)) return null;
  if (spec.spec_version !== 1) return null;
  if (!Array.isArray((spec as any).pipelines)) return null;
  return spec as PipelineProfileSpecV1;
}

type PostStepParamsV1 = {
  blocksMode: BlocksModeV1;
  stateWrites: Array<{
    tag: string;
    kind: string;
    visibility: PipelineArtifactVisibility;
    uiSurface: string;
    contentType: PipelineArtifactContentType;
    promptInclusion?: unknown;
    retentionPolicy?: unknown;
    source: "assistant_response_json_fence" | "assistant_response_text";
    required: boolean;
    writer: { pipelineId: string; stepName: string };
  }>;
};

function parsePostStepParamsFromProfile(spec: unknown | null): PostStepParamsV1 {
  const parsed = parseProfileSpecV1(spec);
  const stateWrites: PostStepParamsV1["stateWrites"] = [];
  let blocksMode: BlocksModeV1 = "single_markdown";

  if (!parsed) return { blocksMode, stateWrites };

  for (const p of parsed.pipelines ?? []) {
    if (!p || !p.enabled) continue;
    const pipelineId = String(p.id ?? "").trim();
    if (!pipelineId) continue;

    for (const s of p.steps ?? []) {
      if (!s || !s.enabled) continue;
      if (s.stepType !== "post") continue;

      // blocks mode: first configured wins (deterministic by profile order)
      if (blocksMode === "single_markdown") {
        const blocks = isRecord(s.params) ? (s.params as any).blocks : null;
        if (isRecord(blocks)) {
          const mode = blocks.mode;
          if (mode === "extract_json_fence") blocksMode = "extract_json_fence";
          if (mode === "single_markdown") blocksMode = "single_markdown";
        }
      }

      // state writes
      const writes = isRecord(s.params) ? (s.params as any).stateWrites : null;
      if (!Array.isArray(writes)) continue;

      for (const w of writes) {
        if (!isRecord(w)) continue;
        const tag = String((w as any).tag ?? "").trim();
        if (!tag) continue;

        const kind = String((w as any).kind ?? "state");
        const visibilityRaw = (w as any).visibility;
        const visibility: PipelineArtifactVisibility =
          visibilityRaw === "prompt_only" ||
          visibilityRaw === "ui_only" ||
          visibilityRaw === "prompt_and_ui" ||
          visibilityRaw === "internal"
            ? visibilityRaw
            : "prompt_and_ui";

        const uiSurface = String((w as any).uiSurface ?? `panel:${tag}`);

        const contentTypeRaw = (w as any).contentType;
        const contentType: PipelineArtifactContentType =
          contentTypeRaw === "text" || contentTypeRaw === "json" || contentTypeRaw === "markdown"
            ? contentTypeRaw
            : "json";

        const sourceRaw = (w as any).source;
        const source: "assistant_response_json_fence" | "assistant_response_text" =
          sourceRaw === "assistant_response_text" || sourceRaw === "assistant_response_json_fence"
            ? sourceRaw
            : contentType === "json"
              ? "assistant_response_json_fence"
              : "assistant_response_text";

        const required = Boolean((w as any).required ?? false);

        stateWrites.push({
          tag,
          kind,
          visibility,
          uiSurface,
          contentType,
          promptInclusion: (w as any).promptInclusion,
          retentionPolicy: (w as any).retentionPolicy,
          source,
          required,
          writer: { pipelineId, stepName: String(s.stepName ?? "post") },
        });
      }
    }
  }

  return { blocksMode, stateWrites };
}

function extractFirstFencedBlock(text: string): { info: string | null; body: string } | null {
  // Matches ```lang\n ... \n```
  const re = /```([a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)\n```/m;
  const m = re.exec(text);
  if (!m) return null;
  const info = typeof m[1] === "string" && m[1].trim() ? m[1].trim() : null;
  return { info, body: m[2] ?? "" };
}

function buildBlocksFromAssistantText(text: string, mode: BlocksModeV1): unknown[] {
  const trimmed = String(text ?? "").trimEnd();
  if (!trimmed) return [];

  if (mode === "extract_json_fence") {
    const fenced = extractFirstFencedBlock(trimmed);
    if (fenced && (fenced.info === null || fenced.info.toLowerCase() === "json")) {
      // Store parsed JSON as a structured UI-only block; keep promptText untouched.
      try {
        const json = JSON.parse(fenced.body);
        return [
          {
            type: "json",
            format: "json",
            content: json,
            visibility: "ui_only",
            order: 0,
          },
        ];
      } catch {
        // Fall back to plain markdown block.
      }
    }
  }

  // Default: one markdown block mirroring promptText.
  return [
    {
      type: "markdown",
      format: "markdown",
      content: trimmed,
      visibility: "both",
      order: 0,
    },
  ];
}

export type PostProcessingResult = {
  blocks: unknown[];
  stateWrites: Array<{
    tag: string;
    status: "written" | "skipped" | "error";
    created?: boolean;
    artifactId?: string;
    basedOnVersion?: number | null;
    newVersion?: number;
    error?: { code: string; message: string };
    writer: { pipelineId: string; stepName: string };
  }>;
};

export async function runPostProcessing(params: {
  ownerId?: string;
  chatId: string;
  assistantMessageId: string;
  assistantVariantId: string;
  activeProfileSpec: unknown | null;
}): Promise<PostProcessingResult> {
  const variant = await getMessageVariantById({ variantId: params.assistantVariantId });
  const assistantText = variant?.promptText ?? "";

  const postParams = parsePostStepParamsFromProfile(params.activeProfileSpec);
  const blocksMode = postParams.blocksMode;
  const blocks = buildBlocksFromAssistantText(assistantText, blocksMode);

  await updateAssistantBlocks({
    assistantMessageId: params.assistantMessageId,
    variantId: params.assistantVariantId,
    blocks,
  });

  const stateWrites: PostProcessingResult["stateWrites"] = [];

  for (const w of postParams.stateWrites) {
    // Note: keep post safe by default. If state extraction fails and not required, skip write.
    try {
      let content: { json?: unknown; text?: string } = {};
      if (w.source === "assistant_response_text") {
        if (w.contentType === "json") {
          // Coerce text to JSON string value (valid JSON).
          content = { json: String(assistantText ?? "") };
        } else {
          content = { text: String(assistantText ?? "") };
        }
      } else {
        const fenced = extractFirstFencedBlock(String(assistantText ?? ""));
        if (!fenced || (fenced.info && fenced.info.toLowerCase() !== "json")) {
          if (w.required) {
            throw new Error(`stateWrites: ожидается JSON fence для art.${w.tag}`);
          }
          stateWrites.push({ tag: w.tag, status: "skipped", writer: w.writer });
          continue;
        }
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(fenced.body);
        } catch (e) {
          if (w.required) {
            throw e instanceof Error ? e : new Error(String(e));
          }
          stateWrites.push({ tag: w.tag, status: "skipped", writer: w.writer });
          continue;
        }
        if (w.contentType === "json") content = { json: parsedJson };
        else if (w.contentType === "markdown") content = { text: fenced.body };
        else content = { text: JSON.stringify(parsedJson) };
      }

      const latest = await getLatestPersistedArtifact({
        ownerId: params.ownerId ?? "global",
        sessionId: params.chatId,
        tag: w.tag,
      });
      const basedOnVersion = latest?.version ?? null;

      const written = await writePersistedArtifact({
        ownerId: params.ownerId ?? "global",
        sessionId: params.chatId,
        tag: w.tag,
        kind: w.kind,
        visibility: w.visibility,
        uiSurface: w.uiSurface,
        contentType: w.contentType,
        content,
        promptInclusion: w.promptInclusion,
        retentionPolicy: w.retentionPolicy,
        basedOnVersion,
        writer: w.writer,
      });

      stateWrites.push({
        tag: w.tag,
        status: "written",
        created: written.created,
        artifactId: written.artifact.id,
        basedOnVersion,
        newVersion: written.artifact.version,
        writer: w.writer,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stateWrites.push({
        tag: w.tag,
        status: "error",
        error: { code: "pipeline_policy_error", message },
        writer: w.writer,
      });
    }
  }

  return { blocks, stateWrites };
}

