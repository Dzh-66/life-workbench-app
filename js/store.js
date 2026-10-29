/* 任务笔记工作台 - GitHub 存储层（全应用唯一触碰 api.github.com 的模块） */
(function (global) {
  "use strict";
  const API_BASE = "https://api.github.com";
  const TOKEN_KEY = "lwb:token";
  const OWNER_KEY = "lwb:owner";
  const REPO_KEY = "lwb:repo";
  const u = global.LWB.util;

  class StoreError extends Error {
    constructor(code, message, status) { super(message); this.code = code; this.status = status; }
  }

  const S = {
    MAX_CLOUD_ATTACH: 3 * 1024 * 1024, // 3MB：超过则走 U 盘路径方案
    rateRemaining: null,

    /* 数据仓库目标：localStorage 覆盖（设置页可改），默认 Dzh-66/life-workbench-data */
    owner: function () { try { return localStorage.getItem(OWNER_KEY) || "Dzh-66"; } catch (e) { return "Dzh-66"; } },
    repo: function () { try { return localStorage.getItem(REPO_KEY) || "life-workbench-data"; } catch (e) { return "life-workbench-data"; } },
    setTarget: function (owner, repo) {
      try {
        if (owner) localStorage.setItem(OWNER_KEY, owner);
        if (repo) localStorage.setItem(REPO_KEY, repo);
      } catch (e) { /* 忽略 */ }
    },
    resetTarget: function () { try { localStorage.removeItem(OWNER_KEY); localStorage.removeItem(REPO_KEY); } catch (e) { /* 忽略 */ } },

    getToken: function () {
      try { return localStorage.getItem(TOKEN_KEY) || null; } catch (e) { return null; }
    },
    setToken: function (t) { try { localStorage.setItem(TOKEN_KEY, t); } catch (e) { /* 忽略 */ } },
    clearToken: function () { try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* 忽略 */ } },

    /* 统一请求：抛 OFFLINE / TOKEN_EXPIRED / FORBIDDEN / RATE_LIMIT；
       其余状态（含 404/409/422）返回 Response 由调用方处理 */
    async _req(method, apiPath, opts) {
      opts = opts || {};
      const headers = {
        "Accept": opts.accept || "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      };
      const token = this.getToken();
      if (token) headers["Authorization"] = "Bearer " + token;
      let body;
      if (opts.body !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(opts.body); }
      let res;
      try {
        res = await fetch(API_BASE + apiPath, { method: method, headers: headers, body: body });
      } catch (e) {
        throw new StoreError("OFFLINE", "网络不可用，请检查网络连接", 0);
      }
      const rl = res.headers.get("X-RateLimit-Remaining");
      if (rl !== null && rl !== undefined) this.rateRemaining = parseInt(rl, 10);
      if (res.status === 401) throw new StoreError("TOKEN_EXPIRED", "Token 无效或已过期", 401);
      if (res.status === 403) {
        const limited = res.headers.get("X-RateLimit-Remaining") === "0";
        throw new StoreError(limited ? "RATE_LIMIT" : "FORBIDDEN",
          limited ? "API 调用次数已达上限，请稍后再试" : "没有访问权限（检查 Token 是否授权了该仓库）", 403);
      }
      return res;
    },

    /* Token 校验：GET /user + 确认对数据仓库有访问权（fine-grained token 无权限时 /repos 返回 404） */
    async validateToken() {
      const res = await this._req("GET", "/user");
      if (res.status !== 200) throw new StoreError("TOKEN_INVALID", "Token 校验失败", res.status);
      const me = await res.json();
      const r2 = await this._req("GET", "/repos/" + this.owner() + "/" + this.repo());
      if (r2.status === 404) throw new StoreError("NO_REPO_ACCESS", "Token 有效，但没有访问 " + this.owner() + "/" + this.repo() + " 的权限（创建 Token 时请仅勾选该仓库并授予 Contents 读写）", 404);
      if (r2.status !== 200) throw new StoreError("REPO_ERROR", "仓库检查失败(" + r2.status + ")", r2.status);
      return { ok: true, login: me.login, rateRemaining: this.rateRemaining };
    },

    /* 拉取 data.json；404 表示云端尚无数据（返回 {data:null,sha:null}） */
    async fetchData() {
      const res = await this._req("GET", "/repos/" + this.owner() + "/" + this.repo() + "/contents/data.json");
      if (res.status === 404) return { data: null, sha: null };
      if (res.status !== 200) throw new StoreError("FETCH_FAILED", "读取数据失败(" + res.status + ")", res.status);
      const meta = await res.json();
      if (typeof meta.content === "string" && meta.content) {
        return { data: JSON.parse(u.b64ToUtf8(meta.content)), sha: meta.sha };
      }
      /* 文件超过 1MB 时 contents 接口不内嵌正文，走 raw 兜底 */
      const raw = await this._req("GET", "/repos/" + this.owner() + "/" + this.repo() + "/contents/data.json", { accept: "application/vnd.github.raw" });
      if (raw.status !== 200) throw new StoreError("FETCH_FAILED", "读取数据失败(" + raw.status + ")", raw.status);
      const text = await raw.text();
      return { data: JSON.parse(text), sha: meta.sha };
    },

    /* 提交 data.json（sha=null 表示新建文件） */
    async saveData(data, sha, message) {
      const body = { message: message, content: u.utf8ToB64(JSON.stringify(data, null, 2)), branch: "main" };
      if (sha) body.sha = sha;
      const res = await this._req("PUT", "/repos/" + this.owner() + "/" + this.repo() + "/contents/data.json", { body: body });
      if (res.status === 409) throw new StoreError("CONFLICT", "数据已被其他设备修改", 409);
      if (res.status === 422) throw new StoreError("UNPROCESSABLE", "提交被拒绝(422)，请刷新后重试", 422);
      if (res.status !== 200 && res.status !== 201) throw new StoreError("SAVE_FAILED", "保存失败(" + res.status + ")", res.status);
      const out = await res.json();
      return out && out.content ? out.content.sha : null;
    },

    /* 附件：取已有文件的 sha（不存在返回 null） */
    async _getSha(path) {
      const res = await this._req("GET", "/repos/" + this.owner() + "/" + this.repo() + "/contents/" + path);
      if (res.status === 200) { const meta = await res.json(); return meta.sha; }
      return null;
    },

    /* 上传附件到 attachments/{nodeId}/{filename}；同名 422 自动加 (n) 后缀重试 */
    async uploadAttachment(nodeId, filename, file) {
      if (file.size > this.MAX_CLOUD_ATTACH) {
        throw new StoreError("TOO_LARGE", "文件超过 3MB，请留在 U 盘并记录路径", 413);
      }
      let name = filename;
      for (let attempt = 0; attempt < 3; attempt++) {
        const path = ("attachments/" + nodeId + "/" + name).split("/").map(encodeURIComponent).join("/");
        const sha = await this._getSha(path);
        const body = {
          message: "📎 附件：" + filename,
          content: u.bytesToB64(new Uint8Array(await file.arrayBuffer())),
          branch: "main"
        };
        if (sha) body.sha = sha;
        const res = await this._req("PUT", "/repos/" + this.owner() + "/" + this.repo() + "/contents/" + path, { body: body });
        if (res.status === 200 || res.status === 201) return { path: path, name: name };
        if (res.status === 422) {
          const dot = name.lastIndexOf(".");
          name = dot > 0 ? name.slice(0, dot) + " (" + (attempt + 1) + ")" + name.slice(dot) : name + " (" + (attempt + 1) + ")";
          continue;
        }
        throw new StoreError("UPLOAD_FAILED", "上传失败(" + res.status + ")", res.status);
      }
      throw new StoreError("UPLOAD_FAILED", "上传失败：文件名冲突", 422);
    },

    async deleteAttachment(path) {
      const sha = await this._getSha(path);
      if (!sha) return; /* 已不存在 */
      const res = await this._req("DELETE", "/repos/" + this.owner() + "/" + this.repo() + "/contents/" + path, { body: { message: "🧹 清理附件", sha: sha, branch: "main" } });
      if (res.status !== 200) throw new StoreError("DELETE_FAILED", "删除附件失败(" + res.status + ")", res.status);
    },

    /* 拉取附件二进制（raw 下载 + blob，避免 base64 二次解码） */
    async fetchAttachmentBlob(path) {
      const res = await this._req("GET", "/repos/" + this.owner() + "/" + this.repo() + "/contents/" + path, { accept: "application/vnd.github.raw" });
      if (res.status !== 200) throw new StoreError("FETCH_FAILED", "读取附件失败(" + res.status + ")", res.status);
      return await res.blob();
    }
  };

  global.LWB.Store = S;
})(window);
