import { BaseService } from "@core/services/base-service";
import { InstructionType } from "@shared/types/instructions";
import { promises as fs } from "fs";
import path from "path";

class Instructions extends BaseService<InstructionType> {
  constructor() {
    super("instructions");
  }
}

export default new Instructions();
