import dotenv from "dotenv";

import { startAppServer } from "./app";

dotenv.config();

async function main(): Promise<void> {
  const rawPort = process.env.PORT;
  const parsedPort = rawPort ? Number(rawPort) : 5000;
  const port = Number.isFinite(parsedPort) ? parsedPort : 5000;
  await startAppServer({ port });
  console.log(`Server is running on port ${port}`);
}

main().catch((error) => {
  console.error("Server bootstrap failed:", error);
  process.exitCode = 1;
});
