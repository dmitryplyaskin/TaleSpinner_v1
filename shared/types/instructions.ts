export type InstructionType = {
  id: string;
  name: string;
  instruction: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
};

export type InstructionSettingsType = {
  selectedId: string | null;
  enableInstruction: boolean;
};
