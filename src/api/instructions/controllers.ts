import { AsyncRequestHandler } from "../common/middleware/async-handler";
import {
  InstructionsService,
  InstructionsSettingsService,
} from "@services/instructions";

export const getInstructionsList: AsyncRequestHandler = async (req) => {
  const instructions = await InstructionsService.getAll();
  return { data: instructions };
};

export const getInstruction: AsyncRequestHandler = async (req) => {
  const instruction = await InstructionsService.getById(
    req.params.instructionId
  );
  return { data: instruction };
};

export const createInstruction: AsyncRequestHandler = async (req) => {
  const instruction = await InstructionsService.create(req.body);
  return { data: instruction };
};

export const updateInstruction: AsyncRequestHandler = async (req) => {
  const instruction = await InstructionsService.update(
    req.params.instructionId,
    req.body
  );
  return { data: instruction };
};

export const deleteInstruction: AsyncRequestHandler = async (req) => {
  await InstructionsService.delete(req.params.instructionId);
  return { data: { id: req.params.instructionId } };
};

export const getInstructionsSettings: AsyncRequestHandler = async (req) => {
  const settings = await InstructionsSettingsService.getConfig();
  return { data: settings };
};

export const setInstructionsSettings: AsyncRequestHandler = async (req) => {
  console.log("setInstructionsSettings", req.body);
  const settings = await InstructionsSettingsService.saveConfig(req.body);
  return { data: settings };
};
