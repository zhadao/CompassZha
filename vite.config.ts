import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Tauri dev 端口固定 1420，与 src-tauri/tauri.conf.json 的 devUrl 一致
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  // v4.27 隐私加固：把作者版开关在构建期折叠为字面量。
  // 公开发布版（未设 VITE_AUTHOR_BUILD）折叠为 "0"，作者标识的模板与文案被彻底摇树移除，
  // 不再以死代码字面量形式残留于公开包的前端产物中。
  define: {
    "import.meta.env.VITE_AUTHOR_BUILD": JSON.stringify(
      process.env.VITE_AUTHOR_BUILD === "1" ? "1" : "0",
    ),
  },
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
