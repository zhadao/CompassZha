import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Tauri dev 端口固定 1420，与 src-tauri/tauri.conf.json 的 devUrl 一致
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  // v4.25 修复：显式清空 outDir——曾出现 dist 残留多代构建产物未被清理，
  // Tauri 全量嵌入导致 exe 逐次膨胀（每代约 +1MB）
  build: {
    emptyOutDir: true,
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
