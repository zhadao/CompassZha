/**
 * 说明书开关（v4.30 §2.16）：跨组件单一真源。
 * - 设置页顶部「详细说明」书本按钮 → openManual()；
 * - 各区块的「详见说明书」内联链接 → openManual()；
 * - Manual 弹层渲染在 SettingsPage 内，读取本 store 决定显隐。
 */
class ManualStore {
  open = $state(false);

  openManual(): void {
    this.open = true;
  }

  closeManual(): void {
    this.open = false;
  }
}

export const manual = new ManualStore();
