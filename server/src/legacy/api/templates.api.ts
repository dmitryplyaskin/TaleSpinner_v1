import express, { type Request } from "express";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";
import { templatesService } from "@services/templates.service";
import {
  type TemplateSettingsType,
  type TemplateType,
} from "@shared/types/templates";
import {
  createPromptTemplate,
  deletePromptTemplate,
  getPromptTemplateById,
  listPromptTemplates,
  updatePromptTemplate,
} from "../../services/chat-core/prompt-templates-repository";

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

router.get(
  "/settings/templates",
  asyncHandler(async () => {
    const settings = await templatesService.templatesSettings.getConfig();
    return { data: settings };
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
    return { data: saved };
  })
);

router.get(
  "/templates",
  asyncHandler(async () => {
    const items = await listPromptTemplates({
      ownerId: "global",
    });
    return { data: items.map(toTemplateType) };
  })
);

router.get(
  "/templates/:id",
  asyncHandler(async (req: Request) => {
    const id = String((req.params as unknown as { id: string }).id);
    const item = await getPromptTemplateById(id);
    if (!item) throw new HttpError(404, "Template не найден", "NOT_FOUND");
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

    const created = await createPromptTemplate({
      id: body.id,
      ownerId: "global",
      name: body.name,
      templateText: body.template ?? "",
      meta: { legacy: true },
    });

    const settings = await templatesService.templatesSettings.getConfig();
    await templatesService.templatesSettings.saveConfig({
      ...settings,
      selectedId: created.id,
    });
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
      throw new HttpError(
        400,
        "id в path/body должен совпадать",
        "VALIDATION_ERROR"
      );
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
      const remaining = await listPromptTemplates({
        ownerId: "global",
      });
      const nextSelected = remaining[0]?.id ?? null;
      await templatesService.templatesSettings.saveConfig({
        ...settings,
        selectedId: nextSelected,
      });
    }

    return { data: { id } };
  })
);

export default router;
