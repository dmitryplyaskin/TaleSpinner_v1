import { Router } from "express";
import {
  getInstructionsList,
  getInstruction,
  createInstruction,
  updateInstruction,
  deleteInstruction,
  getInstructionsSettings,
  setInstructionsSettings,
} from "./controllers";
import { asyncHandler } from "../common/middleware/async-handler";

const router = Router();

router
  .get("/instructions", asyncHandler(getInstructionsList))
  .post("/instructions", asyncHandler(createInstruction));

router
  .get("/instructions/:instructionId", asyncHandler(getInstruction))
  .put("/instructions/:instructionId", asyncHandler(updateInstruction))
  .delete("/instructions/:instructionId", asyncHandler(deleteInstruction));

router
  .get("/settings/instructions", asyncHandler(getInstructionsSettings))
  .post("/settings/instructions", asyncHandler(setInstructionsSettings));

export default router;
