import express, { Request, Response } from "express";
import openRouterService from "../services/open-router-service";

const router = express.Router();

interface GenerateRequest {
  messages: Array<{ role: string; content: string }>;
  settings: Record<string, unknown>;
}

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { messages, settings } = req.body as GenerateRequest;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const messageStream = openRouterService.streamResponse(messages, settings);

    let botResponse = "";
    for await (const chunk of messageStream) {
      if (chunk.error) {
        res.write(`data: ${JSON.stringify({ error: chunk.error })}\n\n`);
        res.end();
        return;
      }

      botResponse += chunk.content;
      res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Chat error:", error);
    res.write(
      `data: ${JSON.stringify({ error: (error as Error).message })}\n\n`
    );
    res.end();
  }
});

export default router;
