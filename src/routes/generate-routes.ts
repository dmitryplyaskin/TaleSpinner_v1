import express, { Request, Response } from "express";
import openRouterService from "../services/open-router-service";

const router = express.Router();
const activeStreams = new Map<string, AbortController>();

interface GenerateRequest {
  messages: Array<{ role: string; content: string }>;
  settings: Record<string, unknown>;
  streamId: string;
}

// Эндпоинт для прерывания стрима
router.post("/abort/:streamId", (req: Request, res: Response) => {
  const { streamId } = req.params;
  const controller = activeStreams.get(streamId);

  if (controller) {
    controller.abort();
    activeStreams.delete(streamId);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: "Stream not found" });
  }
});

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { messages, settings, streamId } = req.body as GenerateRequest;

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
