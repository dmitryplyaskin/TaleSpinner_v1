import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { applyMigrations } from "../../db/apply-migrations";
import { initDb, resetDbForTests } from "../../db/client";
import { ensureInstructionsSchema } from "../../db/ensure-instructions-schema";
import { listEntityProfiles } from "../chat-core/entity-profiles-repository";
import { listInstructions } from "../chat-core/instructions-repository";
import { listUserPersons, updateUserPerson } from "../chat-core/user-persons-repository";
import { samplersService } from "../samplers.service";
import { listWorldInfoBooksForIndexing } from "../world-info/world-info-repositories";

import { scanSillyTavernImportRoot } from "./sillytavern-import-scanner";
import { importSillyTavernSelection } from "./sillytavern-importer";

describe("sillytavern import", () => {
  let tempDir = "";
  let stRoot = "";
  let prevSamplersDir = "";
  let prevSamplersReady: Promise<void> | null = null;

  beforeEach(async () => {
    resetDbForTests();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "talespinner-st-import-"));
    stRoot = path.join(tempDir, "SillyTavern");
    await initDb({ dbPath: path.join(tempDir, "db.sqlite") });
    await applyMigrations();
    await ensureInstructionsSchema();

    const samplersStore = samplersService.samplers as unknown as {
      dir: string;
      ready: Promise<void>;
    };
    prevSamplersDir = samplersStore.dir;
    prevSamplersReady = samplersStore.ready;
    samplersStore.dir = path.join(tempDir, "samplers");
    samplersStore.ready = fs.mkdir(samplersStore.dir, { recursive: true }).then(() => undefined);

    await createFixture(stRoot);
  });

  afterEach(async () => {
    resetDbForTests();
    const samplersStore = samplersService.samplers as unknown as {
      dir: string;
      ready: Promise<void>;
    };
    samplersStore.dir = prevSamplersDir;
    samplersStore.ready = prevSamplersReady ?? Promise.resolve();
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("scans supported SillyTavern profile data", async () => {
    const scan = await scanSillyTavernImportRoot(stRoot);

    expect(scan.profiles).toHaveLength(1);
    expect(scan.totals).toMatchObject({
      character: 1,
      persona: 1,
      world_info: 1,
      instruction: 1,
      sampler: 2,
      chat: 1,
    });
  });

  test("imports selected data and skips duplicates on repeat import", async () => {
    const scan = await scanSillyTavernImportRoot(stRoot);
    const itemIds = scan.profiles.flatMap((profile) =>
      Object.values(profile.items).flatMap((items) => items.map((item) => item.id))
    );

    const first = await importSillyTavernSelection({
      rootPath: stRoot,
      ownerId: "global",
      selection: { itemIds },
    });
    const second = await importSillyTavernSelection({
      rootPath: stRoot,
      ownerId: "global",
      selection: { itemIds },
    });

    expect(first.failed).toEqual([]);
    expect(first.created.some((item) => item.kind === "character")).toBe(true);
    expect(first.created.some((item) => item.kind === "world_info")).toBe(true);
    expect(first.created.some((item) => item.kind === "chat")).toBe(true);
    expect(second.created).toEqual([]);
    expect(second.skipped.every((item) => item.reason === "duplicate")).toBe(true);

    expect(await listEntityProfiles({ ownerId: "global" })).toHaveLength(1);
    const persons = await listUserPersons({ ownerId: "global" });
    expect(persons).toHaveLength(1);
    expect(persons[0]?.avatarUrl).toMatch(/^\/media\/images\/user-persons\//);
    expect(await listWorldInfoBooksForIndexing({ ownerId: "global" })).toHaveLength(2);
    expect(await samplersService.samplers.getAll()).toHaveLength(2);

    const instructions = await listInstructions({ ownerId: "global" });
    expect(instructions).toHaveLength(1);
    const stInstruction = instructions[0];
    expect(stInstruction?.kind).toBe("st_base");
    if (stInstruction?.kind === "st_base") {
      expect(stInstruction.stBase.rawPreset.proxy_password).toBeUndefined();
      expect(stInstruction.stBase.rawPreset.custom_url).toBeUndefined();
    }
  });

  test("repairs legacy imported persona avatar paths on duplicate import", async () => {
    const scan = await scanSillyTavernImportRoot(stRoot);
    const personaId = scan.profiles[0]?.items.persona[0]?.id;
    expect(personaId).toBeTruthy();

    await importSillyTavernSelection({
      rootPath: stRoot,
      ownerId: "global",
      selection: { itemIds: [personaId!] },
    });
    const [created] = await listUserPersons({ ownerId: "global" });
    await updateUserPerson({ id: created!.id, avatarUrl: path.join(stRoot, "data", "default-user", "User Avatars", "persona.png") });

    const second = await importSillyTavernSelection({
      rootPath: stRoot,
      ownerId: "global",
      selection: { itemIds: [personaId!] },
    });

    const [repaired] = await listUserPersons({ ownerId: "global" });
    expect(second.created).toEqual([]);
    expect(second.skipped[0]?.reason).toBe("duplicate");
    expect(repaired?.avatarUrl).toMatch(/^\/media\/images\/user-persons\//);
  });
});

async function createFixture(root: string): Promise<void> {
  const profileRoot = path.join(root, "data", "default-user");
  await fs.mkdir(path.join(profileRoot, "characters"), { recursive: true });
  await fs.mkdir(path.join(profileRoot, "worlds"), { recursive: true });
  await fs.mkdir(path.join(profileRoot, "OpenAI Settings"), { recursive: true });
  await fs.mkdir(path.join(profileRoot, "TextGen Settings"), { recursive: true });
  await fs.mkdir(path.join(profileRoot, "User Avatars"), { recursive: true });
  await fs.mkdir(path.join(profileRoot, "chats", "Alice"), { recursive: true });
  await fs.writeFile(path.join(profileRoot, "User Avatars", "persona.png"), "not-a-real-png");

  await writeJson(path.join(profileRoot, "characters", "Alice.json"), {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: "Alice",
      description: "Alice description",
      personality: "",
      scenario: "",
      first_mes: "Hello",
      mes_example: "",
      alternate_greetings: [],
      tags: [],
      character_book: {
        name: "Alice book",
        entries: {
          "0": { uid: 0, key: ["alice"], content: "Alice lore", comment: "Main" },
        },
      },
    },
  });
  await writeJson(path.join(profileRoot, "worlds", "World.json"), {
    name: "World",
    entries: {
      "0": { uid: 0, key: ["world"], content: "World lore", comment: "World" },
    },
  });
  await writeJson(path.join(profileRoot, "OpenAI Settings", "Preset.json"), {
    chat_completion_source: "openai",
    temperature: 0.7,
    openai_max_tokens: 200,
    proxy_password: "secret",
    custom_url: "https://secret.invalid",
    prompts: [{ identifier: "main", name: "Main", role: "system", content: "System" }],
    prompt_order: [{ character_id: 100001, order: [{ identifier: "main", enabled: true }] }],
  });
  await writeJson(path.join(profileRoot, "TextGen Settings", "Sampler.json"), {
    temp: 0.4,
    top_p: 0.9,
    rep_pen: 1.1,
  });
  await writeJson(path.join(profileRoot, "settings.json"), {
    power_user: {
      personas: { "persona.png": "Persona" },
      persona_descriptions: {
        "persona.png": { description: "Persona description", position: 0, connections: [] },
      },
    },
  });
  await fs.writeFile(
    path.join(profileRoot, "chats", "Alice", "Chat.jsonl"),
    [
      JSON.stringify({ user_name: "Persona", character_name: "Alice" }),
      JSON.stringify({ name: "Persona", is_user: true, is_system: false, mes: "Hi" }),
      JSON.stringify({
        name: "Alice",
        is_user: false,
        is_system: false,
        mes: "Hello",
        swipes: ["Hello", "Hi there"],
        swipe_id: 1,
      }),
    ].join("\n")
  );
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
}
