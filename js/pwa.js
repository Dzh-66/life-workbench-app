/* 任务笔记工作台 - PWA：SW 注册 / 安装提示 / 微信内置浏览器检测 */
(function (global) {
  "use strict";
  const u = global.LWB.util;
  let deferredPrompt = null;

  function init() {
    /* 微信内置浏览器：提示用系统浏览器打开 */
    if (u.isWeChat) {
      const b = document.getElementById("wx-banner");
      if (b) {
        b.hidden = false;
        document.getElementById("wx-copy").addEventListener("click", function () {
          u.copyText(location.href).then(function (ok) {
            const app = global.LWB.App;
            if (app) app.toast("saved", ok ? "✅ 链接已复制，粘贴到系统浏览器打开" : "请长按地址栏手动复制");
          });
        });
      }
    }

    /* SW 仅在 http(s) 下注册（localhost 是 secure context） */
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("./sw.js").catch(function (e) {
          console.warn("SW 注册失败：", e);
        });
      });
    }

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
    });
  }

  function installable() { return !!deferredPrompt; }

  async function promptInstall(app) {
    if (!deferredPrompt) {
      app.toast("error", "当前浏览器不支持一键安装（iPhone 请用 Safari：分享 → 添加到主屏幕）");
      return;
    }
    deferredPrompt.prompt();
    try {
      const r = await deferredPrompt.userChoice;
      if (r && r.outcome === "accepted") app.toast("saved", "✅ 已安装");
    } catch (e) { /* 忽略 */ }
    deferredPrompt = null;
    app.render();
  }

  global.LWB.PWA = { init: init, installable: installable, promptInstall: promptInstall };
  document.addEventListener("DOMContentLoaded", init);
})(window);
