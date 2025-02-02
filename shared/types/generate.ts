export type GenerateMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface StreamResponse {
  content: string;
  error?: string;
}
