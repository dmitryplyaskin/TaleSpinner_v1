import express, { Request, Response } from "express";
import { z } from "zod";
import openRouterService from "../services/open-router-service";
import { HttpError } from "@core/middleware/error-handler";
import { asyncHandler } from "@core/middleware/async-handler";
import { validate } from "@core/middleware/validate";

const router = express.Router();
const activeStreams = new Map<string, AbortController>();

interface GenerateRequest {
  messages: Array<{ role: string; content: string }>;
  settings: Record<string, unknown>;
  streamId: string;
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
      streamId: z.string().min(1),
      messages: z.array(
        z.object({
          role: z.string().min(1),
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

    const { messages, settings, streamId } = parsed.data as GenerateRequest;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const abortController = new AbortController();
    activeStreams.set(streamId, abortController);

    const messageStream = openRouterService.streamResponse(
      messages,
      settings,
      abortController
    );

    let botResponse = "";
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

        botResponse += chunk.content;
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
