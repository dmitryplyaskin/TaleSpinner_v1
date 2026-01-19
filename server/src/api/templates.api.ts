import express, { type Request } from "express";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";
import { templatesService } from "@services/templates.service";
import { type TemplateSettingsType, type TemplateType } from "@shared/types/templates";

import { initDb } from "../db/client";
import { promptTemplates } from "../db/schema";
import {
  createPromptTemplate,
  deletePromptTemplate,
  getPromptTemplateById,
  listPromptTemplates,
  updatePromptTemplate,
} from "../services/chat-core/prompt-templates-repository";

const router = express.Router();

function toTemplateType(dto: {
  id: string;
  name: string;
  templateText: string;
  createdAt: Date;
  updatedAt: Date;
}): TemplateType {
  return {
    id: dto.id,
    name: dto.name,
    template: dto.templateText,
    createdAt: dto.createdAt.toISOString(),
    updatedAt: dto.updatedAt.toISOString(),
  };
}

async function applyGlobalTemplateSettings(params: {
  ownerId: string;
  settings: TemplateSettingsType;
}): Promise<TemplateSettingsType> {
  const ownerId = params.ownerId;
  const db = await initDb();

  const templates = await listPromptTemplates({ ownerId, scope: "global" });

  // If disabled: turn off all global templates.
  if (!params.settings.enabled) {
    await db
      .update(promptTemplates)
      .set({ enabled: false, updatedAt: new Date() })
      .where(
        and(
          eq(promptTemplates.ownerId, ownerId),
          eq(promptTemplates.scope, "global"),
          isNull(promptTemplates.scopeId)
        )
      );
    return params.settings;
  }

  // Enabled=true: ensure we have a selectedId if any template exists.
  const existingIds = new Set(templates.map((t) => t.id));
  const requestedSelected =
    typeof params.settings.selectedId === "string" && params.settings.selectedId.length > 0
      ? params.settings.selectedId
      : null;
  const selectedId =
    (requestedSelected && existingIds.has(requestedSelected) ? requestedSelected : null) ??
    templates[0]?.id ??
    null;

  const nextSettings: TemplateSettingsType = {
    ...params.settings,
    enabled: true,
    selectedId,
  };

  if (!selectedId) return nextSettings;

  // Enforce "single active" behavior for global templates:
  // selectedId => enabled=true, all other global => enabled=false
  await db
    .update(promptTemplates)
    .set({ enabled: false, updatedAt: new Date() })
    .where(
      and(
        eq(promptTemplates.ownerId, ownerId),
        eq(promptTemplates.scope, "global"),
        isNull(promptTemplates.scopeId),
        ne(promptTemplates.id, selectedId)
      )
    );

  await db
    .update(promptTemplates)
    .set({ enabled: true, updatedAt: new Date() })
    .where(eq(promptTemplates.id, selectedId));

  // Persist selectedId if we auto-picked it.
  if (nextSettings.selectedId !== params.settings.selectedId) {
    await templatesService.templatesSettings.saveConfig(nextSettings);
  }

  return nextSettings;
}

// ---- Settings endpoints (legacy UI expects these)

router.get(
  "/settings/templates",
  asyncHandler(async () => {
    const settings = await templatesService.templatesSettings.getConfig();
    // Best-effort: keep DB enabled flags consistent with settings.
    const patched = await applyGlobalTemplateSettings({
      ownerId: "global",
      settings,
    });
    return { data: patched };
  })
);

router.post(
  "/settings/templates",
  validate({
    body: z.object({
      selectedId: z.string().nullable(),
      enabled: z.boolean(),
    }) satisfies z.ZodType<TemplateSettingsType>,
  }),
  asyncHandler(async (req: Request) => {
    const saved = await templatesService.templatesSettings.saveConfig(
      req.body as TemplateSettingsType
    );
    const patched = await applyGlobalTemplateSettings({
      ownerId: "global",
      settings: saved,
    });
    return { data: patched };
  })
);

// ---- Templates endpoints (legacy UI route, but DB-first storage)

router.get(
  "/templates",
  asyncHandler(async () => {
    const items = await listPromptTemplates({ ownerId: "global", scope: "global" });
    return { data: items.map(toTemplateType) };
  })
);

router.get(
  "/templates/:id",
  asyncHandler(async (req: Request) => {
    const id = String((req.params as unknown as { id: string }).id);
    const item = await getPromptTemplateById(id);
    if (!item) throw new HttpError(404, "Template не найден", "NOT_FOUND");
    if (item.scope !== "global") throw new HttpError(404, "Template не найден", "NOT_FOUND");
    return { data: toTemplateType(item) };
  })
);

router.post(
  "/templates",
  validate({
    body: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      template: z.string(),
      createdAt: z.string().min(1),
      updatedAt: z.string().min(1),
    }) satisfies z.ZodType<TemplateType>,
  }),
  asyncHandler(async (req: Request) => {
    const body = req.body as TemplateType;

    // Create DB row using the client-provided id (keeps frontend selection stable).
    const created = await createPromptTemplate({
      id: body.id,
      ownerId: "global",
      scope: "global",
      enabled: true,
      name: body.name,
      templateText: body.template ?? "",
      meta: { legacy: true },
    });

    const settings = await templatesService.templatesSettings.getConfig();
    const nextSettings = await templatesService.templatesSettings.saveConfig({
      ...settings,
      enabled: true,
      selectedId: created.id,
    });

    await applyGlobalTemplateSettings({ ownerId: "global", settings: nextSettings });
    return { data: toTemplateType(created) };
  })
);

router.put(
  "/templates/:id",
  validate({
    body: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      template: z.string(),
      createdAt: z.string().min(1),
      updatedAt: z.string().min(1),
    }) satisfies z.ZodType<TemplateType>,
  }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    const body = req.body as TemplateType;
    if (params.id !== body.id) {
      throw new HttpError(400, "id в path/body должен совпадать", "VALIDATION_ERROR");
    }

    const updated = await updatePromptTemplate({
      id: body.id,
      name: body.name,
      templateText: body.template ?? "",
    });
    if (!updated) throw new HttpError(404, "Template не найден", "NOT_FOUND");
    return { data: toTemplateType(updated) };
  })
);

router.delete(
  "/templates/:id",
  asyncHandler(async (req: Request) => {
    const id = String((req.params as unknown as { id: string }).id);
    const exists = await getPromptTemplateById(id);
    if (!exists) throw new HttpError(404, "Template не найден", "NOT_FOUND");

    await deletePromptTemplate(id);

    const settings = await templatesService.templatesSettings.getConfig();
    if (settings.selectedId === id) {
      const remaining = await listPromptTemplates({ ownerId: "global", scope: "global" });
      const nextSelected = remaining[0]?.id ?? null;
      const saved = await templatesService.templatesSettings.saveConfig({
        ...settings,
        selectedId: nextSelected,
      });
      await applyGlobalTemplateSettings({ ownerId: "global", settings: saved });
    }

    return { data: { id } };
  })
);

export default router;
