/* 任务笔记工作台 - 工具函数（UTF-8 无 BOM） */
(function (global) {
  "use strict";
  const u = {};

  u.esc = function (s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  };

  u.pad = function (n) { return String(n).padStart(2, "0"); };

  u.fmtTime = function (iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.getFullYear() + "-" + u.pad(d.getMonth() + 1) + "-" + u.pad(d.getDate()) + " " + u.pad(d.getHours()) + ":" + u.pad(d.getMinutes());
    } catch (e) { return iso; }
  };

  u.fmtDate = function (iso) {
    if (!iso) return "";
    return u.fmtTime(iso).slice(0, 10);
  };

  u.todayStr = function () {
    const d = new Date();
    return d.getFullYear() + "-" + u.pad(d.getMonth() + 1) + "-" + u.pad(d.getDate());
  };

  /* 日期加减：dateStr 为 YYYY-MM-DD，按本地时区计算 */
  u.addDays = function (dateStr, n) {
    const p = String(dateStr).split("-").map(Number);
    const d = new Date(p[0], p[1] - 1, p[2] + n);
    return d.getFullYear() + "-" + u.pad(d.getMonth() + 1) + "-" + u.pad(d.getDate());
  };

  u.newId = function (prefix) {
    return (prefix || "n") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  u.debounce = function (fn, ms) {
    let t = null;
    const d = function () {
      const args = arguments, self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
    d.cancel = function () { if (t) { clearTimeout(t); t = null; } };
    return d;
  };

  u.truncate = function (s, n) {
    s = String(s == null ? "" : s);
    return s.length > n ? s.slice(0, n) + "…" : s;
  };

  /* base64 编解码（UTF-8 安全；分块转换防长字符串栈溢出） */
  u.utf8ToB64 = function (str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
  };
  u.b64ToUtf8 = function (b64) {
    const bin = atob(String(b64).replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  };
  u.bytesToB64 = function (bytes) {
    let bin = "";
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
  };

  u.weekdayCN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  u.dateCN = function (dateStr) {
    const p = String(dateStr).split("-").map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    return p[1] + "月" + p[2] + "日 · " + u.weekdayCN[d.getDay()];
  };

  u.moodMap = {
    good: { label: "😀 好", icon: "😀" },
    ok: { label: "🙂 还行", icon: "🙂" },
    bad: { label: "😞 差", icon: "😞" }
  };

  u.isWeChat = /MicroMessenger/i.test(navigator.userAgent);
  u.isNarrow = function () { return window.matchMedia("(max-width: 768px)").matches; };

  u.download = function (filename, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  };

  /* 复制文本到剪贴板（兼容旧环境） */
  u.copyText = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return u._fallbackCopy(text); });
    }
    return Promise.resolve(u._fallbackCopy(text));
  };
  u._fallbackCopy = function (text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
      return true;
    } catch (e) { return false; }
  };

  global.LWB = global.LWB || {};
  global.LWB.util = u;
})(window);
