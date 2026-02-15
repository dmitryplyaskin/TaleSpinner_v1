import { eq } from "drizzle-orm";

import { initDb } from "../db/client";
import { chatBranches, chats } from "../db/schema";
import { createChat, getChatById } from "../services/chat-core/chats-repository";
import { createEntityProfile } from "../services/chat-core/entity-profiles-repository";
import { getBranchCurrentTurn } from "../services/chat-entry-parts/branch-turn-repository";
import { createEntryWithVariant } from "../services/chat-entry-parts/entries-repository";
import { createPart } from "../services/chat-entry-parts/parts-repository";
import {
  createVariant,
  selectActiveVariant,
  updateVariantDerived,
} from "../services/chat-entry-parts/variants-repository";

type SeedOptions = {
  chatId?: string;
  ownerId: string;
  messages: number;
  seed: number;
  title: string;
  mode: SeedMode;
};

type EntryRole = "user" | "assistant";
type SizeTier = "short" | "medium" | "long" | "xlong";
type SeedMode = "normal" | "extreme";

function parseArgs(argv: string[]): SeedOptions {
  let messagesProvided = false;
  const opts: SeedOptions = {
    ownerId: "global",
    messages: 320,
    seed: Date.now(),
    title: "Load test chat",
    mode: "normal",
  };

  for (let idx = 0; idx < argv.length; idx += 1) {
    const token = argv[idx];
    const next = argv[idx + 1];

    if (token === "--chat-id" && next) {
      opts.chatId = next;
      idx += 1;
      continue;
    }
    if (token === "--owner-id" && next) {
      opts.ownerId = next;
      idx += 1;
      continue;
    }
    if (token === "--messages" && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) {
        opts.messages = Math.floor(parsed);
        messagesProvided = true;
      }
      idx += 1;
      continue;
    }
    if (token === "--seed" && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed)) opts.seed = Math.floor(parsed);
      idx += 1;
      continue;
    }
    if (token === "--title" && next) {
      opts.title = next;
      idx += 1;
      continue;
    }
    if (token === "--mode" && next) {
      if (next === "normal" || next === "extreme") {
        opts.mode = next;
      }
      idx += 1;
      continue;
    }
    if (token === "--extreme") {
      opts.mode = "extreme";
      continue;
    }
  }

  if (!messagesProvided && opts.mode === "extreme") {
    opts.messages = 1200;
    if (opts.title === "Load test chat") {
      opts.title = "Load test chat (extreme)";
    }
  }

  return opts;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let value = Math.imul(t ^ (t >>> 15), 1 | t);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne<T>(rng: () => number, values: T[]): T {
  const idx = Math.floor(rng() * values.length);
  return values[Math.max(0, Math.min(values.length - 1, idx))]!;
}

function pickSizeTier(rng: () => number, mode: SeedMode): SizeTier {
  if (mode === "extreme") {
    const v = rng();
    if (v < 0.08) return "short";
    if (v < 0.23) return "medium";
    if (v < 0.65) return "long";
    return "xlong";
  }
  const v = rng();
  if (v < 0.35) return "short";
  if (v < 0.65) return "medium";
  if (v < 0.9) return "long";
  return "xlong";
}

const STORY_SENTENCES = [
  "The station hum shifted from calm to uneasy static.",
  "Lilly pressed her palm to the cold bulkhead and listened.",
  "A warning icon flashed above the central hatch in amber.",
  "The room smelled faintly of ozone and burned insulation.",
  "No one spoke for several seconds, but everyone heard the same click.",
  "The gravity ring fought to stabilize and failed a second time.",
  "A tray floated past like a tiny satellite, spinning slowly.",
  "The corridor lights dimmed, then returned with a hard white pulse.",
  "Someone laughed from the speaker, but the voice was synthetic.",
  "The assistant read diagnostics in a tone too calm to trust.",
  "A floor panel detached and struck the opposite wall with a crack.",
  "The emergency shutters did not close when commanded.",
  "Each vibration reached her chest before the sound reached her ears.",
  "The map showed three exits and all three were marked unavailable.",
  "Her breath fogged the visor while the temperature kept rising.",
];

function buildMarkdownParagraphs(
  rng: () => number,
  tier: SizeTier,
  role: EntryRole,
  index: number,
  mode: SeedMode
): string {
  const sentenceCount =
    mode === "extreme"
      ? tier === "short"
        ? 6
        : tier === "medium"
          ? 14
          : tier === "long"
            ? 30
            : 55
      : tier === "short"
        ? 3
        : tier === "medium"
          ? 7
          : tier === "long"
            ? 12
            : 20;
  const parts: string[] = [];

  for (let i = 0; i < sentenceCount; i += 1) {
    parts.push(pickOne(rng, STORY_SENTENCES));
  }

  const lead =
    role === "assistant"
      ? `**Assistant ${Math.floor(index / 2) + 1}:**`
      : `**User ${Math.floor(index / 2) + 1}:**`;
  const body = parts.join(" ");

  const listBlock =
    tier === "xlong" || (tier === "long" && rng() > 0.5)
      ? `\n\n- check coolant loop\n- reroute power to ring C\n- verify hatch pressure`
      : "";

  const quoteBlock =
    rng() > 0.7
      ? `\n\n> "Hold position. We still have one clean path to engineering."`
      : "";

  const codeBlock =
    rng() > (mode === "extreme" ? 0.55 : 0.83)
      ? `\n\n\`\`\`log\nphase=stabilize\nring=gamma\nstatus=degraded\n\`\`\``
      : "";

  const imageBlock =
    rng() > (mode === "extreme" ? 0.68 : 0.9)
      ? `\n\n![diagnostic frame](https://picsum.photos/seed/talespinner-${index}/720/360)`
      : "";

  const tableBlock =
    mode === "extreme" && rng() > 0.45
      ? `\n\n| metric | value |\n|---|---:|\n| stress_index | ${(1 + rng() * 99).toFixed(2)} |\n| retries | ${Math.floor(rng() * 8)} |\n| anomaly | ${rng() > 0.5 ? "yes" : "no"} |`
      : "";

  const heavyRepeatBlock =
    mode === "extreme" && tier === "xlong" && rng() > 0.5
      ? `\n\n${"Signal drift observed. ".repeat(60)}`
      : "";

  return `${lead} ${body}${listBlock}${quoteBlock}${codeBlock}${tableBlock}${imageBlock}${heavyRepeatBlock}`;
}

function buildReasoningTrace(
  rng: () => number,
  index: number,
  mode: SeedMode
): string {
  const steps = [
    "collect telemetry",
    "rank failure hypotheses",
    "check conflicts with user constraints",
    "suppress unstable branch",
    "emit concise response",
  ];
  const stepCount =
    mode === "extreme" ? 6 + Math.floor(rng() * 10) : 2 + Math.floor(rng() * 4);
  const lines: string[] = [];
  for (let i = 0; i < stepCount; i += 1) {
    lines.push(`${i + 1}. ${steps[i % steps.length]}`);
  }
  return `Reasoning snapshot #${index}\n${lines.join("\n")}`;
}

async function resolveChatContext(options: SeedOptions): Promise<{
  chatId: string;
  branchId: string;
  title: string;
}> {
  if (options.chatId) {
    const chat = await getChatById(options.chatId);
    if (!chat) {
      throw new Error(`Chat not found: ${options.chatId}`);
    }
    if (!chat.activeBranchId) {
      throw new Error(`Chat has no active branch: ${options.chatId}`);
    }
    return { chatId: chat.id, branchId: chat.activeBranchId, title: chat.title };
  }

  const profile = await createEntityProfile({
    ownerId: options.ownerId,
    name: `Load profile ${new Date().toISOString().slice(11, 19)}`,
    spec: {
      description: "Synthetic profile for load-testing chat virtualization",
      personality: "calm, concise, technical",
      systemPrompt: "Keep responses deterministic and structured.",
    },
    meta: {
      generatedBy: "seed-large-chat",
      generatedAt: new Date().toISOString(),
    },
  });

  const created = await createChat({
    ownerId: options.ownerId,
    entityProfileId: profile.id,
    title: options.title,
    meta: {
      generatedBy: "seed-large-chat",
      generatedAt: new Date().toISOString(),
    },
  });

  return {
    chatId: created.chat.id,
    branchId: created.mainBranch.id,
    title: created.chat.title,
  };
}

async function seedLargeChat(options: SeedOptions): Promise<void> {
  const rng = mulberry32(options.seed);
  const context = await resolveChatContext(options);
  let turn = await getBranchCurrentTurn({ branchId: context.branchId });
  let lastPreview = "";
  let createdAtMs = Date.now();

  for (let index = 0; index < options.messages; index += 1) {
    const role: EntryRole = index % 2 === 0 ? "user" : "assistant";
    if (role === "assistant") turn += 1;

    const tier = pickSizeTier(rng, options.mode);
    const mainMarkdown = buildMarkdownParagraphs(rng, tier, role, index, options.mode);
    const payloadFormat = role === "user" && rng() > 0.7 ? "text" : "markdown";
    const rendererId = payloadFormat === "text" ? "text" : "markdown";

    const created = await createEntryWithVariant({
      ownerId: options.ownerId,
      chatId: context.chatId,
      branchId: context.branchId,
      role,
      variantKind: role === "assistant" ? "generation" : "manual_edit",
      meta:
        role === "user"
          ? {
              requestId: `seed_req_${index}`,
              seeded: true,
              sizeTier: tier,
            }
          : {
              seeded: true,
              sizeTier: tier,
            },
    });

    if (role === "assistant") {
      await updateVariantDerived({
        variantId: created.variant.variantId,
        derived: {
          generationId: `seed_gen_${index}`,
          seeded: true,
        },
      });
    }

    await createPart({
      ownerId: options.ownerId,
      variantId: created.variant.variantId,
      channel: "main",
      order: 0,
      payload: mainMarkdown,
      payloadFormat,
      visibility: { ui: "always", prompt: true },
      ui: { rendererId },
      prompt: { serializerId: "asText" },
      lifespan: "infinite",
      createdTurn: turn,
      source: role === "assistant" ? "llm" : "user",
      requestId: `seed_part_main_${index}`,
      tags: ["seed", role, tier],
    });

    const reasoningThreshold = options.mode === "extreme" ? 0.4 : 0.72;
    if (role === "assistant" && (index % 3 === 1 || tier === "xlong" || rng() > reasoningThreshold)) {
      await createPart({
        ownerId: options.ownerId,
        variantId: created.variant.variantId,
        channel: "reasoning",
        order: -1,
        payload: buildReasoningTrace(rng, index, options.mode),
        payloadFormat: "markdown",
        visibility: { ui: "always", prompt: false },
        ui: { rendererId: "markdown" },
        prompt: { serializerId: "asText" },
        lifespan: "infinite",
        createdTurn: turn,
        source: "llm",
        requestId: `seed_part_reasoning_${index}`,
        tags: ["seed", "reasoning"],
      });
    }

    if (index % (options.mode === "extreme" ? 2 : 5) === 0) {
      await createPart({
        ownerId: options.ownerId,
        variantId: created.variant.variantId,
        channel: "aux",
        order: 1,
        payload: {
          index,
          role,
          sizeTier: tier,
          latencyMs: Math.floor(50 + rng() * 450),
          confidence: Number((0.2 + rng() * 0.79).toFixed(2)),
        },
        payloadFormat: "json",
        visibility: { ui: "always", prompt: false },
        ui: { rendererId: "json" },
        prompt: { serializerId: "asText" },
        lifespan: "infinite",
        createdTurn: turn,
        source: role === "assistant" ? "llm" : "user",
        requestId: `seed_part_aux_${index}`,
        tags: ["seed", "aux"],
      });
    }

    if (index % (options.mode === "extreme" ? 4 : 11) === 0) {
      await createPart({
        ownerId: options.ownerId,
        variantId: created.variant.variantId,
        channel: "trace",
        order: 2,
        payload: {
          event: "seed.trace",
          step: index,
          branch: context.branchId,
          score: Number((rng() * 10).toFixed(3)),
        },
        payloadFormat: "json",
        visibility: { ui: "debug", prompt: false },
        ui: { rendererId: "json" },
        prompt: { serializerId: "asText" },
        lifespan: { turns: 8 },
        createdTurn: turn,
        source: role === "assistant" ? "llm" : "user",
        requestId: `seed_part_trace_${index}`,
        tags: ["seed", "trace"],
      });
    }

    const variantModulo = options.mode === "extreme" ? 6 : 15;
    if (role === "assistant" && index % variantModulo === 1) {
      const altVariant = await createVariant({
        ownerId: options.ownerId,
        entryId: created.entry.entryId,
        kind: "generation",
        derived: {
          generationId: `seed_alt_gen_${index}`,
          seeded: true,
        },
      });

      await createPart({
        ownerId: options.ownerId,
        variantId: altVariant.variantId,
        channel: "main",
        order: 0,
        payload: `${buildMarkdownParagraphs(rng, pickSizeTier(rng, options.mode), "assistant", index, options.mode)}\n\n_Alt variant_`,
        payloadFormat: "markdown",
        visibility: { ui: "always", prompt: true },
        ui: { rendererId: "markdown" },
        prompt: { serializerId: "asText" },
        lifespan: "infinite",
        createdTurn: turn,
        source: "llm",
        requestId: `seed_variant_alt_main_${index}`,
        tags: ["seed", "variant_alt"],
      });

      const activateAltModulo = options.mode === "extreme" ? 12 : 30;
      if (index % activateAltModulo === 1) {
        await selectActiveVariant({
          entryId: created.entry.entryId,
          variantId: altVariant.variantId,
        });
      }
    }

    createdAtMs += 1;
    lastPreview = mainMarkdown.replace(/\s+/g, " ").trim().slice(0, 140);
  }

  const db = await initDb();
  const now = new Date();
  await db
    .update(chats)
    .set({
      updatedAt: now,
      lastMessageAt: new Date(createdAtMs),
      lastMessagePreview: lastPreview,
    })
    .where(eq(chats.id, context.chatId));
  await db
    .update(chatBranches)
    .set({
      updatedAt: now,
      currentTurn: turn,
    })
    .where(eq(chatBranches.id, context.branchId));

  console.log("Seed completed");
  console.log(`chatId=${context.chatId}`);
  console.log(`branchId=${context.branchId}`);
  console.log(`title=${context.title}`);
  console.log(`messagesAdded=${options.messages}`);
  console.log(`seed=${options.seed}`);
  console.log(`mode=${options.mode}`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await seedLargeChat(options);
}

main().catch((error) => {
  console.error("Failed to seed large chat");
  console.error(error);
  process.exit(1);
});
