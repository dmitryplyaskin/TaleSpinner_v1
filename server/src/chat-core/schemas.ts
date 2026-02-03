import { z } from "zod";

// ---- Common helpers

export const idSchema = z.string().min(1);

export const ownerIdSchema = z.string().min(1).default("global");

export const jsonValueSchema: z.ZodType<unknown> = z.unknown();

export const messageRoleSchema = z.enum(["user", "assistant", "system"]);

export const messageVariantKindSchema = z.enum([
  "generation",
  "manual_edit",
  "import",
]);

export const promptTemplateScopeSchema = z.enum([
  "global",
  "entity_profile",
  "chat",
]);

export const chatStatusSchema = z.enum(["active", "archived", "deleted"]);

// ---- Blocks (v1: keep as JSON)

export const messageBlockSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.string().min(1),
  format: z.string().min(1).optional(),
  content: z.unknown(),
  visibility: z.enum(["ui_only", "prompt_only", "both"]).optional(),
  order: z.number().optional(),
});

export const blocksSchema = z.array(messageBlockSchema).default([]);

// ---- EntityProfiles

export const createEntityProfileBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  name: z.string().min(1),
  kind: z.literal("CharSpec").optional().default("CharSpec"),
  spec: jsonValueSchema,
  meta: jsonValueSchema.optional(),
  avatarAssetId: z.string().min(1).optional(),
});

export const updateEntityProfileBodySchema = z.object({
  id: idSchema,
  name: z.string().min(1).optional(),
  // v1 is fixed, but allow explicit value for idempotency
  kind: z.literal("CharSpec").optional(),
  spec: jsonValueSchema.optional(),
  meta: jsonValueSchema.optional(),
  avatarAssetId: z.string().min(1).nullable().optional(),
});

// ---- Chats

export const createChatForEntityProfileParamsSchema = z.object({
  id: idSchema, // entityProfileId
});

export const createChatBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  title: z.string().min(1).default("New chat"),
  meta: jsonValueSchema.optional(),
});

export const chatIdParamsSchema = z.object({
  id: idSchema, // chatId
});

export const branchIdParamsSchema = z.object({
  id: idSchema, // chatId
  branchId: idSchema,
});

// ---- Branches

export const createBranchBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  title: z.string().min(1).optional(),
  parentBranchId: idSchema.optional(),
  forkedFromMessageId: idSchema.optional(),
  forkedFromVariantId: idSchema.optional(),
  meta: jsonValueSchema.optional(),
});

// ---- Messages

export const listMessagesQuerySchema = z.object({
  branchId: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  before: z.coerce.number().int().positive().optional(), // createdAt (ms) cursor
});

export const createMessageBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  branchId: idSchema.optional(),
  role: messageRoleSchema,
  promptText: z.string().default(""),
  format: z.string().min(1).optional(),
  blocks: blocksSchema.optional(),
  meta: jsonValueSchema.optional(),
});

// ---- Prompt templates

export const listPromptTemplatesQuerySchema = z
  .object({
    scope: promptTemplateScopeSchema,
    scopeId: idSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.scope !== "global" && !val.scopeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scopeId обязателен для scope=chat/entity_profile",
        path: ["scopeId"],
      });
    }
    if (val.scope === "global" && typeof val.scopeId === "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scopeId запрещён для scope=global",
        path: ["scopeId"],
      });
    }
  });

export const createPromptTemplateBodySchema = z
  .object({
    ownerId: ownerIdSchema.optional(),
    name: z.string().min(1),
    enabled: z.boolean().optional().default(true),
    scope: promptTemplateScopeSchema,
    scopeId: idSchema.optional(),
    engine: z.literal("liquidjs").optional().default("liquidjs"),
    templateText: z.string().min(1),
    meta: jsonValueSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.scope !== "global" && !val.scopeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scopeId обязателен для scope=chat/entity_profile",
        path: ["scopeId"],
      });
    }
    if (val.scope === "global" && typeof val.scopeId === "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scopeId запрещён для scope=global",
        path: ["scopeId"],
      });
    }
  });

export const updatePromptTemplateBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    enabled: z.boolean().optional(),
    scope: promptTemplateScopeSchema.optional(),
    scopeId: idSchema.optional().nullable(),
    engine: z.literal("liquidjs").optional(),
    templateText: z.string().min(1).optional(),
    meta: jsonValueSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (typeof val.scope !== "undefined" && val.scope !== "global") {
      if (!val.scopeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "scopeId обязателен при изменении scope на chat/entity_profile",
          path: ["scopeId"],
        });
      }
    }
    if (
      val.scope === "global" &&
      typeof val.scopeId !== "undefined" &&
      val.scopeId !== null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scopeId запрещён для scope=global",
        path: ["scopeId"],
      });
    }
  });

// ---- Variants (minimal for v1 endpoints later)

export const messageIdParamsSchema = z.object({
  id: idSchema, // messageId
});

export const selectVariantParamsSchema = z.object({
  id: idSchema, // messageId
  variantId: idSchema,
});

// ---- Manual edit variant (v1)

export const createManualEditVariantBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  promptText: z.string().default(""),
  blocks: blocksSchema.optional(),
  meta: jsonValueSchema.optional(),
});

// ---- User persons (global, v1)

export const userPersonTypeSchema = z.literal("default");

export const createUserPersonBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  id: idSchema.optional(),
  name: z.string().min(1),
  prefix: z.string().optional(),
  avatarUrl: z.string().optional(),
  type: userPersonTypeSchema.optional().default("default"),
  contentTypeDefault: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const updateUserPersonBodySchema = z.object({
  name: z.string().min(1).optional(),
  prefix: z.string().optional(),
  avatarUrl: z.string().optional(),
  type: userPersonTypeSchema.optional(),
  contentTypeDefault: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const updateUserPersonsSettingsBodySchema = z.object({
  ownerId: ownerIdSchema.optional(),
  selectedId: idSchema.nullable(),
  enabled: z.boolean(),
  pageSize: z.number().int().min(1).max(200).optional(),
  sortType: z.string().nullable().optional(),
});
