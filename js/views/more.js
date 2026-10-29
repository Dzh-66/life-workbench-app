/* 任务笔记工作台 - 更多视图（Token 设置 / 同步 / 备份与导入 / 帮助与关于） */
(function (global) {
  "use strict";
  const u = global.LWB.util;
  const Model = global.LWB.Model;
  const Store = global.LWB.Store;
  const PWA = global.LWB.PWA;
  const A = function () { return global.LWB.App; };

  /* 视图内部状态（render 重跑时保留） */
  let tokenMsg = null;      // {cls, text}
  let tokenShown = false;

  const PAT_GUIDE = [
    "1. 浏览器打开 https://github.com/settings/tokens?type=beta",
    "2. 点 Generate new token",
    "3. Token name：life-workbench（多设备建议 life-workbench-手机 / life-workbench-PC，便于区分和单独吊销）",
    "4. Expiration：90 days（到期重新生成即可；Token 失效不影响仓库里的数据）",
    "5. Resource owner：Dzh-66",
    "6. Repository access：Only select repositories → 只勾选 life-workbench-data",
    "7. Permissions → Repository permissions → Contents: Read and write（唯一需要的权限，其余保持 No access）",
    "8. 点 Generate token，复制 github_pat_ 开头的一长串（只显示一次）",
    "9. 回到本页粘贴 → 点「校验并保存」，显示 ✓ 即成功"
  ];

  const SNAPSHOT_TEMPLATE = '<!doctype html>\n<html lang="zh-CN"><head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>任务笔记工作台 · 备份快照</title>\n<style>\nbody{margin:0;background:#0b0e1a;color:#e8f6ff;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif}\n.wrap{max-width:820px;margin:0 auto;padding:20px 16px 60px}\nh1{font-size:1.3rem;letter-spacing:.1em;color:#00f0ff;text-shadow:0 0 12px rgba(0,240,255,.6)}\n.meta{color:#7a8db8;font-size:.8rem;margin-bottom:16px}\nh2{font-size:1rem;color:#ff2bd6;margin:22px 0 8px}\n.node{margin:6px 0;padding:8px 10px;background:#12162b;border:1px solid rgba(0,240,255,.25);border-radius:10px;font-size:.9rem}\n.node .n{color:#e8f6ff}\n.node .badge{font-size:.7rem;color:#39ff88;border:1px solid rgba(57,255,136,.5);border-radius:99px;padding:1px 7px;margin-left:6px}\n.node.done .n{color:#7a8db8;text-decoration:line-through}\n.note{color:#9fb4d8;font-size:.8rem;margin-top:4px;white-space:pre-wrap}\n.att{font-size:.75rem;color:#00f0ff;margin-top:4px}\n.att img{max-width:180px;max-height:120px;border-radius:8px;display:block;margin-top:4px}\n.tl{font-size:.85rem;color:#9fb4d8;margin:4px 0}\n.j{font-size:.85rem;margin:4px 0}\n.h{font-size:.85rem;margin:4px 0;color:#ffd94f}\n</style>\n</head><body><div class="wrap">\n<h1>任务笔记工作台 · 备份快照</h1>\n<div class="meta" id="meta"></div>\n<div id="app">加载中…</div>\n</div>\n<script type="application/json" id="lwb-backup">__PAYLOAD__<\/script>\n<script>\n(function(){\nvar p=JSON.parse(document.getElementById("lwb-backup").textContent);\nvar d=p.data,atts=p.attachments||{};\ndocument.getElementById("meta").textContent="导出于 "+(p.exportedAt||"")+" · 任务 "+(d.nodes||[]).length+" 个 · 里程碑 "+(d.milestones||[]).length+" 个 · 习惯 "+(d.habits||[]).length+" 个 · 日记 "+Object.keys(d.journals||{}).length+" 篇";\nfunction esc(s){var e=document.createElement("div");e.textContent=s==null?"":String(s);return e.innerHTML;}\nvar byParent={};d.nodes.forEach(function(n){var k=n.parentId||"ROOT";(byParent[k]=byParent[k]||[]).push(n);});\nObject.keys(byParent).forEach(function(k){byParent[k].sort(function(a,b){return (a.createdAt||"").localeCompare(b.createdAt||"");});});\nfunction walk(pid,depth){var kids=byParent[pid]||[];var h="";kids.forEach(function(n){\nvar cls=n.status==="done"?"node done":"node";\nvar st={todo:"待办",inprogress:"进行中",done:"已完成"}[n.status]||"待办";\nh+=\'<div class="\'+cls+\'" style="margin-left:\'+(depth*18)+\'px"><span class="n">\'+esc(n.title)+\'</span><span class="badge">\'+st+\'</span>\'+(n.note?\'<div class="note">\'+esc(n.note)+\'</div>\':"")+(n.attachments||[]).map(function(a){\nif(a.storage==="usb")return \'<div class="att">💾 U盘：\'+esc(a.usbPath||a.name||"")+\'</div>\';\nvar url=atts[a.path];if(!url)return \'<div class="att">📎 \'+esc(a.name||"")+\'（未打包）</div>\';\nif((a.type||"").indexOf("image/")===0)return \'<div class="att">📎 \'+esc(a.name||"")+\'<img src="\'+url+\'" alt=""></div>\';\nreturn \'<div class="att">📎 \'+esc(a.name||"")+\'</div>\';}).join("")+"</div>";\nh+=walk(n.id,depth+1);});return h;}\nvar html=\'<h2>🌳 任务树</h2>\'+walk("ROOT",0);\nhtml+=\'<h2>🏆 里程碑</h2>\'+(d.milestones||[]).slice().reverse().map(function(m){return \'<div class="tl">\'+esc(m.date)+" 🏆 "+esc(m.title)+(m.note?" — "+esc(m.note):"")+"</div>";}).join("")||\'<div class="tl">无</div>\';\nhtml+=\'<h2>🔥 习惯</h2>\'+(d.habits||[]).map(function(h){return \'<div class="h">\'+esc(h.title)+" · 打卡 "+h.dates.length+" 次</div>";}).join("")||\'<div class="h">无</div>\';\nhtml+=\'<h2>📔 日记</h2>\'+Object.keys(d.journals||{}).sort().reverse().map(function(k){var j=d.journals[k];return \'<div class="j">\'+esc(k)+" "+(j.mood?["😀","🙂","😞"][{good:0,ok:1,bad:2}[j.mood]||1]:"")+" "+esc(j.text)+"</div>";}).join("")||\'<div class="j">无</div>\';\nhtml+=\'<h2>📈 轨迹</h2>\';(function(){var ev=[];d.nodes.forEach(function(n){if(n.createdAt)ev.push([n.createdAt,"🌱 创建 "+n.title]);if(n.completedAt)ev.push([n.completedAt,"✅ 完成 "+n.title]);});ev.sort(function(a,b){return b[0].localeCompare(a[0]);});html+=ev.slice(0,60).map(function(e){return \'<div class="tl">\'+esc(e[0])+" "+esc(e[1])+"</div>";}).join("")||"无";})();\ndocument.getElementById("app").innerHTML=html;\n})();\n</script>\n</body></html>';

  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      const fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(new Error("读取失败")); };
      fr.readAsDataURL(blob);
    });
  }

  function render(main) {
    const app = A();
    const data = app.state.data;
    const hasToken = !!Store.getToken();
    const cacheTs = app.state.cacheTs;
    const lastSync = data && data.preferences ? data.preferences.lastSyncAt : null;
    const canInstall = PWA.installable();
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    let html = "";

    /* ── Token 设置 ── */
    html += '<section class="card"><h2>🔑 数据连接（Token）</h2>'
      + '<p class="muted">数据保存在私有仓库 <b>' + u.esc(Store.owner()) + '/' + u.esc(Store.repo()) + '</b>。每台设备输入一次 Token 即可读写；Token 只存在本机浏览器，不会上传。</p>'
      + '<div class="row">'
      + '<input type="' + (tokenShown ? "text" : "password") + '" id="token-input" class="text-input" placeholder="粘贴 github_pat_ 开头的 Token" autocomplete="off">'
      + '<button type="button" class="icon-btn" data-act="toggle-token">' + (tokenShown ? "🙈" : "👁") + '</button>'
      + '</div>'
      + (tokenMsg ? '<div class="token-result ' + u.esc(tokenMsg.cls) + '">' + tokenMsg.text + '</div>' : '')
      + '<div class="row-btns">'
      + '<button type="button" class="btn" data-act="save-token">校验并保存</button>'
      + (hasToken ? '<button type="button" class="btn ghost" data-act="clear-token">清除 Token</button>' : '')
      + '</div>'
      + '<details class="details"><summary>怎么创建 Token？（分步指引）</summary><ol class="guide">'
      + PAT_GUIDE.map(function (s) { return '<li>' + u.esc(s) + '</li>'; }).join('')
      + '</ol></details>'
      + '</section>';

    /* ── 数据仓库目标（高级） ── */
    html += '<section class="card"><h2>🗄 数据仓库（高级）</h2>'
      + '<p class="muted">默认 Dzh-66 / life-workbench-data，一般无需修改。</p>'
      + '<div class="row">'
      + '<input type="text" id="owner-input" class="text-input" value="' + u.esc(Store.owner()) + '" placeholder="owner">'
      + '<input type="text" id="repo-input" class="text-input" value="' + u.esc(Store.repo()) + '" placeholder="repo">'
      + '<button type="button" class="btn ghost" data-act="save-target">保存</button>'
      + '</div></section>';

    /* ── 同步与备份 ── */
    html += '<section class="card"><h2>🔄 同步与备份</h2>'
      + '<div class="row-btns">'
      + '<button type="button" class="btn" data-act="sync-now">立即同步</button>'
      + '<button type="button" class="btn ghost" data-act="export-json">导出 data.json</button>'
      + '<button type="button" class="btn ghost" data-act="export-snapshot">导出全量快照</button>'
      + '<button type="button" class="btn ghost" data-act="import-backup">导入备份</button>'
      + '<button type="button" class="btn ghost danger-ghost" data-act="clear-cache">清除本地缓存</button>'
      + '</div>'
      + '<p class="muted">· <b>导出快照</b>：生成一个自包含 HTML 文件（数据 + 附件），双击即可离线查看，建议定期存到 U 盘。<br>'
      + '· <b>导入备份</b>：支持 .json 数据文件或快照 .html；导入后立即提交云端。<br>'
      + '· 云端每次保存都是一次 git 提交，历史永不丢失。</p>'
      + '</section>';

    /* ── 安装到设备 ── */
    html += '<section class="card"><h2>📲 添加到主屏幕</h2>'
      + '<p class="muted">' + (isIOS
        ? 'iPhone/iPad：用 <b>Safari</b> 打开本页 → 点分享按钮 → 「添加到主屏幕」。'
        : 'Android：浏览器菜单（⋮）→ 「添加到主屏幕 / 安装应用」。桌面 Chrome：地址栏右侧安装图标。') + '</p>'
      + (canInstall ? '<div class="row-btns"><button type="button" class="btn" data-act="install-app">📦 安装应用</button></div>' : '')
      + '</section>';

    /* ── 关于 ── */
    html += '<section class="card"><h2>ℹ️ 关于</h2>'
      + '<p class="muted">任务笔记工作台 v' + u.esc(global.LWB.App.version) + '<br>'
      + '最近同步：' + (lastSync ? u.esc(u.fmtTime(lastSync)) : "尚未同步") + '<br>'
      + '本地快照：' + (cacheTs ? u.esc(u.fmtTime(cacheTs)) : "无") + '<br>'
      + '数据仓库：' + u.esc(Store.owner()) + '/' + u.esc(Store.repo()) + '（私有，每次保存 = 一次 git 提交，历史即成长档案）</p>'
      + '</section>';

    main.innerHTML = html;
  }

  function setTokenMsg(cls, text) { tokenMsg = { cls: cls, text: text }; A().render(); }

  async function saveToken(app) {
    const inp = document.getElementById("token-input");
    const t = (inp.value || "").trim();
    if (!t) { app.toast("error", "请先粘贴 Token"); return; }
    app.toast("saving", "⏳ 校验中…");
    try {
      Store.setToken(t);
      const r = await Store.validateToken();
      setTokenMsg("ok", "✓ 有效（账号 " + r.login + "）");
      app.state.mode = "ready";
      app.setSyncStatus("syncing", "⏳ 同步中…");
      if (app.queue.length) {
        await app.flush();
      } else {
        await app.reloadFromCloud();
      }
    } catch (err) {
      const map = {
        TOKEN_EXPIRED: "Token 无效或已过期，请重新生成",
        TOKEN_INVALID: "Token 校验失败",
        NO_REPO_ACCESS: "Token 有效但没有访问 " + Store.owner() + "/" + Store.repo() + " 的权限（创建时请仅勾选该仓库并授予 Contents 读写）",
        REPO_ERROR: "数据仓库不存在或无法访问",
        FORBIDDEN: "没有访问权限",
        RATE_LIMIT: "API 调用次数已达上限，稍后再试",
        OFFLINE: "网络不可用"
      };
      setTokenMsg("err", "✗ " + (map[err.code] || (err.message || "校验失败")));
      app.toast("error", "❌ " + (map[err.code] || (err.message || "校验失败")));
    }
  }

  async function exportSnapshot(app) {
    app.toast("saving", "⏳ 正在打包快照…");
    try {
      const data = app.state.data;
      const attachments = {};
      const tasks = [];
      data.nodes.forEach(function (n) {
        (n.attachments || []).forEach(function (a) { if (a.storage === "cloud" && a.path) tasks.push(a); });
      });
      for (const a of tasks) {
        try {
          const blob = await Store.fetchAttachmentBlob(a.path);
          if (blob.size > 15 * 1024 * 1024) continue;
          attachments[a.path] = await blobToDataURL(blob);
        } catch (e) { /* 单个附件失败则跳过 */ }
      }
      const payload = { exportedAt: new Date().toISOString(), data: data, attachments: attachments };
      /* 防止数据中的 "</script>" 提前闭合快照脚本标签 */
      const payloadStr = JSON.stringify(payload).replace(/<\//g, "<\\/");
      const html = SNAPSHOT_TEMPLATE.replace("__PAYLOAD__", payloadStr);
      u.download("工作台快照_" + u.todayStr() + ".html", new Blob([html], { type: "text/html;charset=utf-8" }));
      app.toast("saved", "✅ 快照已导出（含 " + Object.keys(attachments).length + " 个附件）");
    } catch (err) {
      app.toast("error", "❌ 导出失败：" + (err.message || ""));
    }
  }

  function exportJson(app) {
    try {
      const text = JSON.stringify(app.state.data, null, 2);
      u.download("工作台数据_" + u.todayStr() + ".json", new Blob([text], { type: "application/json;charset=utf-8" }));
      app.toast("saved", "✅ data.json 已导出");
    } catch (err) {
      app.toast("error", "❌ 导出失败：" + (err.message || ""));
    }
  }

  /* 供 app.js 的文件选择回调调用 */
  async function importBackupFile(file, app) {
    try {
      const text = await file.text();
      let payload = null;
      try { payload = JSON.parse(text); } catch (e) { /* 不是纯 JSON，尝试快照 HTML */ }
      if (!payload) {
        const m = text.match(/<script type="application\/json" id="lwb-backup">([\s\S]*?)<\/script>/);
        if (!m) { app.toast("error", "❌ 无法识别的备份文件（需要 .json 或快照 .html）"); return; }
        try { payload = JSON.parse(m[1]); } catch (e) { app.toast("error", "❌ 备份内容已损坏"); return; }
      }
      const data = payload.data || payload;
      if (!data || !Array.isArray(data.nodes)) { app.toast("error", "❌ 备份缺少任务数据（nodes）"); return; }
      const c = Model.counts(Model.migrate(data));
      const ok = window.confirm(
        "将用备份覆盖当前数据：\n\n" +
        "· 任务节点 " + c.nodes + " 个\n" +
        "· 里程碑 " + c.milestones + " 个\n" +
        "· 习惯 " + c.habits + " 个\n" +
        "· 日记 " + c.journals + " 篇\n\n" +
        "（云端附件文件不随导入恢复，可手动重新上传）\n确定继续吗？"
      );
      if (!ok) return;
      app.mutate(function () { return data; }, { type: "import", n: c.nodes });
      app.toast("saved", "✅ 导入已提交");
    } catch (err) {
      app.toast("error", "❌ 导入失败：" + (err.message || ""));
    }
  }

  function onEvent(kind, el, ev) {
    const app = A();
    const act = el.getAttribute ? el.getAttribute("data-act") : null;

    if (kind === "click") {
      if (act === "toggle-token") { tokenShown = !tokenShown; app.render(); return; }
      if (act === "save-token") { saveToken(app); return; }
      if (act === "clear-token") {
        Store.clearToken();
        app.state.mode = "readonly";
        setTokenMsg(null, "");
        tokenMsg = null;
        app.setSyncStatus("readonly", "未绑定 Token");
        app.render();
        app.toast("saving", "已清除本机 Token，当前为只读模式");
        return;
      }
      if (act === "save-target") {
        const o = (document.getElementById("owner-input").value || "").trim();
        const r = (document.getElementById("repo-input").value || "").trim();
        if (!o || !r) { app.toast("error", "owner 和 repo 都不能为空"); return; }
        Store.setTarget(o, r);
        app.toast("saved", "✅ 数据仓库已改为 " + o + "/" + r + "，下次同步生效");
        app.render();
        return;
      }
      if (act === "sync-now") { app.syncNow(); return; }
      if (act === "export-json") { exportJson(app); return; }
      if (act === "export-snapshot") { exportSnapshot(app); return; }
      if (act === "import-backup") { document.getElementById("import-input").click(); return; }
      if (act === "install-app") { PWA.promptInstall(app); return; }
      if (act === "clear-cache") {
        if (!window.confirm("确定清除本地缓存吗？（云端数据不受影响，下次打开将重新从云端加载）")) return;
        app.clearCache();
        app.toast("saved", "✅ 已清除，正在刷新…");
        setTimeout(function () { location.reload(); }, 800);
        return;
      }
      return;
    }
  }

  global.LWB = global.LWB || {};
  global.LWB.views = global.LWB.views || {};
  global.LWB.views.more = { render: render, onEvent: onEvent, importBackupFile: importBackupFile };
})(window);
