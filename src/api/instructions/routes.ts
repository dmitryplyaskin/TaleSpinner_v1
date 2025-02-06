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

router.get("/instructions", asyncHandler(getInstructionsList));
router.get("/instructions/:instructionId", asyncHandler(getInstruction));
router.post("/instructions", asyncHandler(createInstruction));
router.put("/instructions/:instructionId", asyncHandler(updateInstruction));
router.delete("/instructions/:instructionId", asyncHandler(deleteInstruction));

router.get("/settings/instructions", asyncHandler(getInstructionsSettings));
router.post("/settings/instructions", asyncHandler(setInstructionsSettings));

export default router;
