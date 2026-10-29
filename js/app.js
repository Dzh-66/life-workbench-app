/* 任务笔记工作台 - 启动引导 / 全局状态 / 保存队列（单飞防抖）/ 冲突合并 / hash 路由 / 事件分发 */
(function (global) {
  "use strict";
  const u = global.LWB.util;
  const Store = global.LWB.Store;
  const Model = global.LWB.Model;
  const Commit = global.LWB.Commit;

  const CACHE_KEY = "lwb:cache";
  const FLUSH_DELAY = 1500;   // 防抖合并：1.5s 内连续操作合并为一条提交
  const APP_VERSION = "1.0.0";
  const VIEWS = ["focus", "tree", "timeline", "journal", "more"];
  const TITLES = { focus: "今日焦点", tree: "领域树", timeline: "成长轨迹", journal: "日记", more: "更多" };
  const NAV_ICONS = { focus: "🎯", tree: "🌳", timeline: "📈", journal: "📔", more: "⚙️" };

  const App = {
    version: APP_VERSION,
    state: {
      view: "focus",          // 当前视图
      data: null,             // 当前数据（已迁移）
      sha: null,              // 云端 data.json 的 sha（PUT 基准）
      mode: "loading",        // loading | ready | init | readonly | offline
      saving: false,          // 单飞：同一时刻只允许一个 PUT
      online: true,
      cacheTs: null,          // 本地快照时间
      queue: [],              // 待提交 [{mutator, op}]
      treeFilter: null,       // 树视图筛选（route 传入）
      treeFocusId: null       // 跳转到树视图时聚焦的节点
    },
    _pending: null,           // 正在提交中的批次
    _flushTimer: null,

    /* ── 基础 ── */
    writable: function () { return this.state.mode === "ready" && !!Store.getToken(); },

    toast: function (kind, msg) {
      const el = document.getElementById("toast");
      el.className = "toast " + kind;
      el.textContent = msg;
      el.hidden = false;
      if (this._toastTimer) clearTimeout(this._toastTimer);
      if (kind !== "error") {
        this._toastTimer = setTimeout(function () { el.hidden = true; }, 2500);
      }
    },

    setSyncStatus: function (cls, msg) {
      const el = document.getElementById("sync-status");
      el.className = "sync-status " + cls;
      el.textContent = msg;
      el.title = "点击立即同步";
    },

    readCache: function () {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const c = JSON.parse(raw);
        return (c && c.data) ? c : null;
      } catch (e) { return null; }
    },
    writeCache: function (data, sha) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: data, sha: sha, ts: new Date().toISOString() }));
      } catch (e) { /* 快照超限则忽略，云端仍是权威 */ }
    },
    clearCache: function () { try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* 忽略 */ } },

    /* ── 启动 ── */
    async boot() {
      const cache = this.readCache();
      this.state.cacheTs = cache ? cache.ts : null;
      if (Store.getToken()) {
        this.setSyncStatus("syncing", "⏳ 同步中…");
        try {
          const r = await Store.fetchData();
          if (r.data) {
            this.state.data = Model.migrate(r.data);
            this.state.sha = r.sha;
            this.state.mode = "ready";
            this.writeCache(this.state.data, r.sha);
            this.setSyncStatus("synced", "● 已同步");
          } else {
            /* 云端尚无数据：有本地快照则先展示，等待用户初始化 */
            this.state.data = cache ? Model.migrate(cache.data) : Model.empty();
            this.state.sha = null;
            this.state.mode = "init";
            this.setSyncStatus("warn", "云端尚无数据");
          }
        } catch (err) {
          if (err.code === "TOKEN_EXPIRED") {
            this.state.data = cache ? Model.migrate(cache.data) : Model.empty();
            this.state.mode = "readonly";
            this.setSyncStatus("error", "Token 失效");
            this.toast("error", "⚠️ Token 无效或已过期，请到「更多 → 设置」重新输入");
          } else {
            this.state.data = cache ? Model.migrate(cache.data) : Model.empty();
            this.state.mode = "offline";
            this.setSyncStatus("offline", "离线只读" + (cache ? " · " + u.fmtTime(cache.ts) : ""));
          }
        }
      } else {
        this.state.data = cache ? Model.migrate(cache.data) : Model.empty();
        this.state.mode = "readonly";
        this.setSyncStatus("readonly", cache ? "只读 · 未绑定 Token" : "未绑定 Token");
      }
      this.route();
      this.render();
    },

    /* ── 变更入口：所有写操作都经过这里 ── */
    /* mutator(data) 就地修改草稿；返回对象则整体替换。op 用于生成提交消息 */
    mutate: function (mutator, op) {
      if (!this.writable()) {
        this.toast("error", this.state.mode === "readonly"
          ? "当前为只读模式，请先在「更多 → 设置」绑定 Token"
          : "当前离线，无法保存");
        return false;
      }
      const draft = structuredClone(this.state.data);
      const r = mutator(draft);
      this.state.data = (r && typeof r === "object") ? Model.migrate(r) : draft;
      Model.pruneFocusDates(this.state.data, u.todayStr());
      this.queue.push({ mutator: mutator, op: op });
      this.render();
      this.scheduleFlush();
      return true;
    },

    scheduleFlush: function () {
      if (this._flushTimer) clearTimeout(this._flushTimer);
      this._flushTimer = setTimeout(() => { this.flush(); }, FLUSH_DELAY);
    },

    /* 单飞提交：合并队列 → PUT；409 自动重拉重放；失败回退队列 */
    async flush() {
      if (this.state.saving || !this.queue.length) return;
      this._pending = this.queue.slice();
      this.queue = [];
      this.state.saving = true;
      this.setSyncStatus("saving", "⏳ 保存中…");
      const snapshot = structuredClone(this.state.data);
      const baseMsg = Commit.msg(this._pending[0].op) + (this._pending.length > 1 ? "（等 " + this._pending.length + " 项）" : "");
      try {
        const newSha = await Store.saveData(snapshot, this.state.sha, baseMsg);
        this.state.sha = newSha;
        this.state.data.preferences.lastSyncAt = new Date().toISOString();
        this.writeCache(this.state.data, newSha);
        this.state.online = true;
        this._pending = null;
        this.setSyncStatus("synced", "● 已同步");
        this.toast("saved", "✅ 已保存");
        if (Store.rateRemaining !== null && Store.rateRemaining < 50) {
          this.toast("saving", "⚠️ API 剩余调用次数不多（" + Store.rateRemaining + "）");
        }
      } catch (err) {
        if (err.code === "CONFLICT") {
          await this._handleConflict(snapshot, baseMsg);
        } else if (err.code === "OFFLINE") {
          this.state.online = false;
          this.queue = this._pending.concat(this.queue);
          this._pending = null;
          this.setSyncStatus("unsynced", "⚠️ 未同步 · 点击重试");
          this.toast("error", "❌ 网络不可用，修改已保留在本页，恢复网络后点击状态栏重试");
        } else if (err.code === "TOKEN_EXPIRED") {
          this.state.mode = "readonly";
          this.queue = this._pending.concat(this.queue);
          this._pending = null;
          this.setSyncStatus("error", "Token 失效");
          this.toast("error", "⚠️ Token 失效，修改暂存于本页；请到「更多 → 设置」更新 Token 后点击状态栏重试");
        } else {
          this.queue = this._pending.concat(this.queue);
          this._pending = null;
          this.setSyncStatus("unsynced", "⚠️ 保存失败 · 点击重试");
          this.toast("error", "❌ 保存失败：" + (err.message || "未知错误"));
        }
      } finally {
        this.state.saving = false;
        /* 不自动重试：失败后由用户点状态栏、下次修改或恢复网络事件触发 */
      }
    },

    /* 409：自动重拉云端，把本批次全部修改重放到最新数据上再提交；二次冲突弹窗选择 */
    async _handleConflict(snapshot, baseMsg) {
      /* 冲突处理期间的新修改也一并纳入重放（同批提交） */
      this._pending = this._pending.concat(this.queue);
      this.queue = [];
      try {
        const r = await Store.fetchData();
        let rebased = Model.migrate(r.data);
        for (const item of this._pending) {
          const ret = item.mutator(rebased);
          if (ret && typeof ret === "object") rebased = Model.migrate(ret);
        }
        const newSha = await Store.saveData(rebased, r.sha, baseMsg + "（冲突自动合并）");
        /* 重放期间产生的新修改：重新应用到合并结果上（其 op 留在 queue，下次提交） */
        let finalData = rebased;
        for (const item of this.queue) {
          const ret = item.mutator(finalData);
          if (ret && typeof ret === "object") finalData = Model.migrate(ret);
        }
        this.state.data = finalData;
        this.state.sha = newSha;
        this.writeCache(finalData, newSha);
        this._pending = null;
        this.setSyncStatus("synced", "● 已同步（自动合并）");
        this.toast("saved", "✅ 已保存（与其他设备的修改自动合并）");
      } catch (e2) {
        const choice = window.confirm(
          "云端数据刚被其他设备修改，自动合并失败。\n\n" +
          "点「确定」：用本地数据覆盖云端\n" +
          "点「取消」：放弃本地未保存的修改，重新加载云端数据"
        );
        if (choice) {
          try {
            const r = await Store.fetchData();
            const newSha = await Store.saveData(snapshot, r.sha, baseMsg + "（手动覆盖）");
            this.state.sha = newSha;
            this.writeCache(snapshot, newSha);
            this._pending = null;
            this.setSyncStatus("synced", "● 已同步（本地覆盖）");
            this.toast("saved", "✅ 已保存（本地覆盖云端）");
          } catch (e3) {
            this.queue = this._pending.concat(this.queue);
            this._pending = null;
            this.setSyncStatus("unsynced", "⚠️ 保存失败 · 点击重试");
            this.toast("error", "❌ 保存失败：" + (e3.message || "未知错误"));
          }
        } else {
          await this.reloadFromCloud();
        }
      }
    },

    async reloadFromCloud() {
      try {
        const r = await Store.fetchData();
        if (r.data) {
          this.state.data = Model.migrate(r.data);
          this.state.sha = r.sha;
          this.state.mode = "ready";
          this.writeCache(r.data, r.sha);
          this.queue = [];
          this._pending = null;
          this.setSyncStatus("synced", "● 已同步");
        } else {
          this.state.mode = "init";
          this.state.sha = null;
          this.setSyncStatus("warn", "云端尚无数据");
        }
      } catch (err) {
        this.toast("error", "重新加载失败：" + (err.message || ""));
      }
      this.render();
    },

    /* 「立即同步」：先提交本地修改，再拉取云端 */
    async syncNow() {
      if (this.state.mode === "init") { this.toast("saving", "云端尚无数据，请先初始化"); this.render(); return; }
      if (!Store.getToken()) { this.toast("error", "请先在「更多 → 设置」绑定 Token"); return; }
      this.setSyncStatus("syncing", "⏳ 同步中…");
      try {
        if (this.queue.length) await this.flush();
        await this.reloadFromCloud();
        this.toast("saved", "✅ 已同步");
      } catch (err) {
        this.toast("error", "❌ 同步失败：" + (err.message || ""));
        this.setSyncStatus("unsynced", "⚠️ 同步失败 · 点击重试");
      }
    },

    /* 云端初始化（写入种子数据） */
    async initCloud() {
      if (!Store.getToken()) { this.toast("error", "请先在「更多 → 设置」绑定 Token"); return; }
      this.setSyncStatus("saving", "⏳ 初始化中…");
      try {
        const seed = structuredClone(global.LWB.seed);
        const newSha = await Store.saveData(seed, null, Commit.msg({ type: "init" }));
        this.state.data = seed;
        this.state.sha = newSha;
        this.state.mode = "ready";
        this.writeCache(seed, newSha);
        this.setSyncStatus("synced", "● 已同步");
        this.toast("saved", "✅ 云端数据已初始化");
        this.render();
      } catch (err) {
        this.setSyncStatus("unsynced", "⚠️ 初始化失败");
        this.toast("error", "❌ 初始化失败：" + (err.message || "未知错误"));
      }
    },

    /* ── 附件辅助 ── */
    openFilePicker(nodeId) {
      this._uploadNodeId = nodeId;
      const fi = document.getElementById("file-input");
      fi.value = "";
      fi.click();
    },
    async attachCloud(nodeId, file) {
      const node = Model.findNode(this.state.data, nodeId);
      this.toast("saving", "⏳ 上传中…");
      try {
        const up = await Store.uploadAttachment(nodeId, file.name, file);
        this.mutate(function (s) {
          const n = Model.findNode(s, nodeId);
          if (n) {
            if (!n.attachments) n.attachments = [];
            n.attachments.push({
              name: up.name, path: up.path, size: file.size, type: file.type || "",
              storage: "cloud", usbPath: null, uploadedAt: new Date().toISOString()
            });
          }
        }, { type: "attach", node: node ? node.title : "", file: file.name });
      } catch (err) {
        if (err.code === "TOO_LARGE") {
          this.toast("error", "⚠️ 文件超过 3MB，请留在 U 盘，点「💾 记U盘文件」记录路径");
        } else {
          this.toast("error", "❌ 上传失败：" + (err.message || "未知错误"));
        }
      }
    },
    /* 记录 U 盘附件（不上传） */
    async attachUsb(nodeId, name, usbPath) {
      const node = Model.findNode(this.state.data, nodeId);
      this.mutate(function (s) {
        const n = Model.findNode(s, nodeId);
        if (n) {
          if (!n.attachments) n.attachments = [];
          n.attachments.push({
            name: name || "U盘文件", path: null, size: null, type: "", storage: "usb",
            usbPath: usbPath, uploadedAt: new Date().toISOString()
          });
        }
      }, { type: "usb-path", node: node ? node.title : "", file: name });
      this.toast("saved", "✅ 已记录 U 盘路径");
    },
    async openAttachment(nodeId, idx) {
      const node = Model.findNode(this.state.data, nodeId);
      const att = node && (node.attachments || [])[idx];
      if (!att) return;
      if (att.storage === "usb") {
        if (att.usbPath) u.copyText(att.usbPath).then(function () { /* 已在调用方提示 */ });
        this.toast("saving", "📁 该文件在 U 盘：" + (att.usbPath || ""));
        return;
      }
      try {
        const blob = await Store.fetchAttachmentBlob(att.path);
        u.download(att.name, blob);
      } catch (err) {
        this.toast("error", "下载失败：" + (err.message || ""));
      }
    },

    /* 图片附件懒加载预览（blob URL 会话内缓存） */
    _thumbCache: new Map(),
    _thumbObserver: null,
    hydrateThumbs(container) {
      const imgs = container.querySelectorAll("img.att-thumb");
      for (const img of imgs) {
        const path = img.getAttribute("data-att-path");
        if (!path) continue;
        const cached = this._thumbCache.get(path);
        if (cached) { img.src = cached; continue; }
        if (!this._thumbObserver) {
          this._thumbObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const im = entry.target;
              this._thumbObserver.unobserve(im);
              this._loadThumb(im.getAttribute("data-att-path"), im);
            });
          }, { rootMargin: "200px 0px" });
        }
        this._thumbObserver.observe(img);
      }
    },
    async _loadThumb(path, img) {
      try {
        const blob = await Store.fetchAttachmentBlob(path);
        const url = URL.createObjectURL(blob);
        this._thumbCache.set(path, url);
        if (img.isConnected && img.getAttribute("data-att-path") === path) img.src = url;
      } catch (e) {
        if (img.isConnected) {
          img.alt = "图片预览不可用";
          img.classList.add("att-thumb-unavailable");
        }
      }
    },

    /* 跳转到树视图并聚焦某节点 */
    gotoNode(nodeId) {
      this.state.treeFocusId = nodeId;
      this.state.treeFilter = null;
      if (location.hash === "#/tree") { this.route(); this.render(); }
      else location.hash = "#/tree";
    },

    /* ── 路由 ── */
    route() {
      const h = location.hash.replace(/^#\/?/, "");
      let view = null;
      if (h) {
        const q = h.indexOf("?");
        const base = q > -1 ? h.slice(0, q) : h;
        if (VIEWS.indexOf(base) > -1) view = base;
        this.state.treeFilter = (q > -1) ? (new URLSearchParams(h.slice(q + 1)).get("filter") || null) : null;
      }
      if (!view) {
        /* 无 hash：按偏好默认视图 */
        view = (this.state.data && this.state.data.preferences && VIEWS.indexOf(this.state.data.preferences.defaultView) > -1)
          ? this.state.data.preferences.defaultView : "focus";
      }
      this.state.view = view;
    },

    /* ── 渲染 ── */
    render() {
      document.getElementById("view-title").textContent = TITLES[this.state.view];
      const v = global.LWB.views[this.state.view];
      const main = document.getElementById("main");
      if (v) v.render(main, this);
      this.renderNav();
      this.renderBanners();
    },
    renderNav() {
      document.querySelectorAll("[data-view]").forEach(function (btn) {
        btn.setAttribute("aria-selected", btn.getAttribute("data-view") === App.state.view ? "true" : "false");
      });
    },
    renderBanners() {
      const b = document.getElementById("sync-banner");
      const m = this.state.mode;
      if (m === "ready") { b.hidden = true; return; }
      let html = "";
      if (m === "readonly") {
        html = '<span>👁 只读模式（未绑定 Token 或 Token 失效）</span><button type="button" class="btn" data-act="goto-more">去设置绑定</button>';
      } else if (m === "offline") {
        html = '<span>📴 离线模式 · 数据只读' + (this.state.cacheTs ? '（快照截至 ' + u.fmtTime(this.state.cacheTs) + '）' : "") + '</span><button type="button" class="btn" data-act="retry-sync">重试</button>';
      } else if (m === "init") {
        html = '<span>☁️ 云端还没有数据</span><button type="button" class="btn" data-act="init-cloud">用示例数据初始化</button>';
      }
      b.innerHTML = html;
      b.hidden = false;
    },

    /* ── 事件分发（main 容器级委托，视图通过 onEvent 响应） ── */
    bindEvents() {
      const main = document.getElementById("main");
      main.addEventListener("click", (e) => {
        const el = e.target.closest("[data-act]");
        if (el) this.dispatch("click", el, e);
      });
      main.addEventListener("change", (e) => {
        const el = e.target.closest("[data-act]");
        if (el) this.dispatch("change", el, e);
      });
      main.addEventListener("submit", (e) => {
        const f = e.target.closest("form[data-form]");
        if (f) { e.preventDefault(); this.dispatch("submit", f, e); }
      });
      main.addEventListener("focusout", (e) => { this.dispatch("focusout", e.target, e); });
      main.addEventListener("input", (e) => { this.dispatch("input", e.target, e); });
      /* 心情按钮：按下时不抢焦点，避免触发 textarea 失焦自动保存 */
      main.addEventListener("mousedown", (e) => {
        if (e.target.closest("[data-mood-prevent]")) e.preventDefault();
      });

      document.querySelectorAll("[data-view]").forEach((btn) => {
        btn.addEventListener("click", () => { location.hash = "#/" + btn.getAttribute("data-view"); });
      });
      window.addEventListener("hashchange", () => { this.route(); this.render(); });
      window.addEventListener("online", () => {
        this.state.online = true;
        if (this.queue.length) this.flush();
        else if (this.state.mode === "offline") { this.state.mode = "ready"; this.reloadFromCloud(); }
      });
      window.addEventListener("offline", () => {
        this.state.online = false;
        this.setSyncStatus("offline", "离线只读");
      });

      document.getElementById("sync-status").addEventListener("click", () => {
        if (this.state.mode === "init") this.initCloud();
        else this.syncNow();
      });

      /* 全局横幅按钮 */
      document.getElementById("sync-banner").addEventListener("click", (e) => {
        const el = e.target.closest("[data-act]");
        if (!el) return;
        const act = el.getAttribute("data-act");
        if (act === "goto-more") location.hash = "#/more";
        else if (act === "retry-sync") this.syncNow();
        else if (act === "init-cloud") this.initCloud();
      });

      /* 附件文件选择 */
      document.getElementById("file-input").addEventListener("change", (e) => {
        const f = e.target.files[0];
        const nodeId = this._uploadNodeId;
        this._uploadNodeId = null;
        if (f && nodeId) this.attachCloud(nodeId, f);
      });
      /* 备份导入文件选择 */
      document.getElementById("import-input").addEventListener("change", (e) => {
        const f = e.target.files[0];
        e.target.value = "";
        if (f) global.LWB.views.more.importBackupFile(f, this);
      });
    },
    dispatch(kind, el, ev) {
      const v = global.LWB.views[this.state.view];
      if (v && v.onEvent) v.onEvent(kind, el, ev, this);
    }
  };

  global.LWB.App = App;
  global.LWB.NAV_ICONS = NAV_ICONS;
  global.LWB.VIEWS = VIEWS;
  global.LWB.TITLES = TITLES;

  document.addEventListener("DOMContentLoaded", function () {
    App.bindEvents();
    App.boot();
  });
})(window);
