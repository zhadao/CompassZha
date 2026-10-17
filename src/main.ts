import { mount } from "svelte";
import "./tokens.css";
import "./app.css";
import { applyAppearance, readAppearanceLocal } from "./lib/theme";
import App from "./App.svelte";

// v4.17 防闪白：挂载前先把 localStorage 外观快照应用到 <html>（store init 后以 config.json 覆盖）
applyAppearance(readAppearanceLocal());

// v4.20 §2.9：全局屏蔽 WebView 默认右键菜单（右键 = 功能入口，空白处右键无反应）；
// 输入框（input/textarea/contenteditable）放行，保留原生粘贴/复制菜单
window.addEventListener("contextmenu", (e) => {
  const t = e.target as HTMLElement;
  if (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t.isContentEditable
  ) {
    return;
  }
  e.preventDefault();
});

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
