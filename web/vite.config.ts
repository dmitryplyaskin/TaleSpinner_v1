import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envDirectory = "..";
  const env = loadEnv(mode, envDirectory, "VITE_");
  const backendTarget =
    env.VITE_DEV_PROXY_TARGET?.trim() || "http://127.0.0.1:5000";

  return {
    envDir: envDirectory,
    plugins: [react(), tsconfigPaths()],
    server: {
      proxy: {
        "/api": { target: backendTarget, changeOrigin: true },
        "/media": { target: backendTarget, changeOrigin: true },
        "/defaults": { target: backendTarget, changeOrigin: true },
      },
    },
    build: {
      outDir: "../server/public",
      emptyOutDir: true,
    },
  };
});
