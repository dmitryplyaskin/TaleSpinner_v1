import { z } from "zod";

// ---- Common helpers

export const idSchema = z.string().min(1);

export const ownerIdSchema = z.string().min(1).default("global");

export const jsonValueSchema: z.ZodType<unknown> = z.unknown();

export const messageRoleSchema = z.enum(["user", "assistant", "system"]);

export const messageVariantKindSchema = z.enum(["generation", "manual_edit", "import"]);

export const promptTemplateScopeSchema = z.enum(["global", "entity_profile", "chat"]);

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

// ---- Variants (minimal for v1 endpoints later)

export const messageIdParamsSchema = z.object({
  id: idSchema, // messageId
});

export const selectVariantParamsSchema = z.object({
  id: idSchema, // messageId
  variantId: idSchema,
});

