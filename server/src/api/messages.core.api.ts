import express, { type Request } from "express";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import { messageIdParamsSchema } from "../chat-core/schemas";
import { softDeleteChatMessage } from "../services/chat-core/chats-repository";

const router = express.Router();

router.delete(
  "/messages/:id",
  validate({ params: messageIdParamsSchema }),
  asyncHandler(async (req: Request) => {
    const params = req.params as unknown as { id: string };
    try {
      const deleted = await softDeleteChatMessage({ messageId: params.id });
      return { data: deleted };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("не найден")) {
        throw new HttpError(404, "Message не найден", "NOT_FOUND");
      }
      throw error;
    }
  })
);

export default router;

