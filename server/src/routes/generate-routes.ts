import express, { type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { asyncHandler } from "@core/middleware/async-handler";
import { HttpError } from "@core/middleware/error-handler";
import { validate } from "@core/middleware/validate";

import { streamGlobalChat } from "../services/llm/llm-service";

import type { GenerateMessage } from "@shared/types/generate";

const router = express.Router();
const activeStreams = new Map<string, AbortController>();

interface GenerateRequest {
  messages: GenerateMessage[];
  settings: Record<string, unknown>;
  streamId?: string;
}

// Эндпоинт для прерывания стрима
const abortParamsSchema = z.object({
  streamId: z.string().min(1),
});

router.post(
  "/abort/:streamId",
  validate({ params: abortParamsSchema }),
  asyncHandler((req: Request) => {
    const streamId = req.params.streamId as unknown as string;
    const controller = activeStreams.get(streamId);

    if (!controller) {
      throw new HttpError(404, "Stream not found", "STREAM_NOT_FOUND");
    }

    controller.abort();
    activeStreams.delete(streamId);
    return { data: { success: true } };
  })
);

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const generateSchema = z.object({
      streamId: z.string().min(1).optional(),
      messages: z.array(
        z.object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string(),
        })
      ),
      settings: z.record(z.string(), z.unknown()).optional().default({}),
    });

    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          message: "Validation error",
          code: "VALIDATION_ERROR",
          details: parsed.error.issues,
        },
      });
      return;
    }

    const { messages, settings } = parsed.data as GenerateRequest;
    const streamId = parsed.data.streamId ?? uuidv4();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const abortController = new AbortController();
    activeStreams.set(streamId, abortController);

    const messageStream = streamGlobalChat({
      messages,
      settings,
      abortController,
    });

    // Send stream meta first (useful when client didn't provide streamId)
    res.write(`data: ${JSON.stringify({ streamId })}\n\n`);

    // let botResponse = "";
    try {
      for await (const chunk of messageStream) {
        if (abortController.signal.aborted) {
          break;
        }

        if (chunk.error) {
          res.write(`data: ${JSON.stringify({ error: chunk.error })}\n\n`);
          res.end();
          return;
        }

        if (!chunk.content) {
          continue;
        }

        // botResponse += chunk.content;
        res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
      }

      res.write("data: [DONE]\n\n");
    } finally {
      activeStreams.delete(streamId);
    }

    res.end();
  } catch (error) {
    const streamId = (req.body as Partial<GenerateRequest>).streamId;
    console.error("Chat error:", error);
    res.write(
      `data: ${JSON.stringify({ error: (error as Error).message })}\n\n`
    );
    res.end();
    if (streamId) {
      activeStreams.delete(streamId);
    }
  }
});

export default router;
