import express from "express";
import { asyncHandler } from "../common/middleware/async-handler";
import * as controllers from "./controllers";

const router = express.Router();

router
  .route("/chats")
  .get(asyncHandler(controllers.getChatHistory))
  .post(asyncHandler(controllers.createChat));

router
  .route("/chats/:chatId")
  .get(asyncHandler(controllers.getChat))
  .put(asyncHandler(controllers.updateChat))
  .delete(asyncHandler(controllers.deleteChat));

router
  .route("/chats/:chatId/duplicate")
  .post(asyncHandler(controllers.duplicateChat));

export default router;
