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

const router = Router();

router.get("/instructions", getInstructionsList);
router.get("/instructions/:instructionId", getInstruction);
router.post("/instructions", createInstruction);
router.put("/instructions/:instructionId", updateInstruction);
router.delete("/instructions/:instructionId", deleteInstruction);

router.get("/instructions/settings", getInstructionsSettings);
router.post("/instructions/settings", setInstructionsSettings);

export default router;
