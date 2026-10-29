/* 任务笔记工作台 - 领域树视图（任务树 + 笔记筛选 + 附件 + 焦点星标 + 里程碑快捷入口） */
(function (global) {
  "use strict";
  const u = global.LWB.util;
  const Model = global.LWB.Model;
  const Store = global.LWB.Store;
  const A = function () { return global.LWB.App; };

  /* 视图内部状态（跨 render 保持） */
  let editingId = null, noteDraftId = null, usbFormId = null, mobileFocusId = null;

  function statusOp(prev, next, title) {
    if (next === "done") return { type: "done", title: title };
    if (next === "inprogress") return { type: "start", title: title };
    if (prev === "done") return { type: "reopen", title: title };
    return { type: "update", title: title };
  }

  function statusBadge(n) {
    if (n.type === "domain") return '<span class="badge domain">领域</span>';
    const map = { todo: "待办", inprogress: "进行中", done: "已完成" };
    return '<span class="badge ' + u.esc(n.status || "todo") + '">' + u.esc(map[n.status] || "待办") + '</span>';
  }

  function attItem(n, att, idx) {
    const isImg = att.storage === "cloud" && (att.type || "").indexOf("image/") === 0;
    let body;
    if (att.storage === "usb") {
      body = '<div class="att-thumb-unavailable">💾 U盘文件</div>';
    } else if (isImg) {
      body = '<img class="att-thumb" data-att-path="' + u.esc(att.path) + '" alt="' + u.esc(att.name || "附件图片") + '" decoding="async">';
    } else {
      body = '<div class="att-thumb-unavailable">📄 ' + u.esc((att.type || "").indexOf("video/") === 0 ? "视频" : "文件") + '</div>';
    }
    let acts = '<button type="button" class="icon-btn" data-act="att-open" data-id="' + u.esc(n.id) + '" data-idx="' + idx + '">' + (att.storage === "usb" ? "复制路径" : "下载") + '</button>'
      + '<button type="button" class="icon-btn danger" data-act="att-del" data-id="' + u.esc(n.id) + '" data-idx="' + idx + '">删除</button>';
    return '<div class="att-item">' + body
      + '<div class="att-name" title="' + u.esc(att.storage === "usb" ? (att.usbPath || att.name) : att.name) + '">' + u.esc(att.name || att.path || "附件") + '</div>'
      + '<div class="att-acts">' + acts + '</div></div>';
  }
  function renderAttachments(n) {
    const atts = n.attachments || [];
    if (!atts.length) return "";
    let html = '<div class="att-list">';
    for (let i = 0; i < atts.length; i++) html += attItem(n, atts[i], i);
    return html + '</div>';
  }
  function noteEditor(n) {
    return '<form class="note-editor" data-form="note-edit" data-id="' + u.esc(n.id) + '">'
      + '<textarea name="note" maxlength="5000" aria-label="笔记" placeholder="在这里写笔记，失焦或点保存即提交…">' + u.esc(n.note || "") + '</textarea>'
      + '<div class="row"><button type="submit" class="btn">保存笔记</button>'
      + '<button type="button" class="btn ghost" data-act="cancel-note">收起</button>'
      + '<span class="tip">失焦也会自动保存</span></div>'
      + '</form>';
  }
  function nodeEditForm(n) {
    const isTask = n.type !== "domain";
    return '<form class="node-edit" data-form="node-edit" data-id="' + u.esc(n.id) + '">'
      + '<input type="text" name="title" value="' + u.esc(n.title) + '" maxlength="120" aria-label="节点名称" placeholder="名称">'
      + '<textarea name="note" maxlength="2000" aria-label="笔记说明" placeholder="写点笔记/说明…">' + u.esc(n.note || "") + '</textarea>'
      + '<input type="text" name="wspath" value="' + u.esc(n.workspacePath || "") + '" maxlength="300" aria-label="工作区文件夹路径" placeholder="工作区文件夹路径（可选，如 智商/数学/竞赛资料）">'
      + (isTask ? '<div class="row"><label>状态：</label><select name="status" aria-label="状态">'
        + '<option value="todo"' + (n.status === "todo" ? " selected" : "") + '>待办</option>'
        + '<option value="inprogress"' + (n.status === "inprogress" ? " selected" : "") + '>进行中</option>'
        + '<option value="done"' + (n.status === "done" ? " selected" : "") + '>已完成</option>'
        + '</select></div>' : '')
      + '<div class="row"><button type="submit" class="btn">保存</button>'
      + '<button type="button" class="btn ghost" data-act="cancel-edit">取消</button></div>'
      + '</form>';
  }
  function usbForm(n) {
    return '<form class="node-edit" data-form="usb-add" data-id="' + u.esc(n.id) + '">'
      + '<input type="text" name="fname" maxlength="120" aria-label="文件名" placeholder="文件名称（如 高数笔记.pdf）">'
      + '<input type="text" name="fpath" maxlength="300" aria-label="U盘路径" placeholder="U盘路径（如 F:\\资料\\高数笔记.pdf）">'
      + '<div class="row"><button type="submit" class="btn">记录</button>'
      + '<button type="button" class="btn ghost" data-act="cancel-usb">取消</button></div>'
      + '</form>';
  }
  function nodeActions(n) {
    const app = A();
    const today = u.todayStr();
    const focused = (n.focusDates || []).indexOf(today) > -1;
    let acts = '<button type="button" class="icon-btn" data-act="add-child" data-id="' + u.esc(n.id) + '">＋子项</button>'
      + '<button type="button" class="icon-btn" data-act="edit" data-id="' + u.esc(n.id) + '">✎ 编辑</button>'
      + '<button type="button" class="icon-btn" data-act="note" data-id="' + u.esc(n.id) + '">📝 笔记</button>'
      + '<button type="button" class="icon-btn" data-act="upload" data-id="' + u.esc(n.id) + '">📎 传附件</button>'
      + '<button type="button" class="icon-btn" data-act="usb-form" data-id="' + u.esc(n.id) + '">💾 记U盘文件</button>'
      + '<button type="button" class="icon-btn' + (focused ? " focused" : "") + '" data-act="star" data-id="' + u.esc(n.id) + '" title="设为今日焦点">' + (focused ? "★ 今日焦点" : "☆ 今日焦点") + '</button>'
      + '<button type="button" class="icon-btn" data-act="ms-from-node" data-id="' + u.esc(n.id) + '">🏆 里程碑</button>'
      + '<button type="button" class="icon-btn nav-btn" data-act="nav" data-id="' + u.esc(n.id) + '" aria-label="进入 ' + u.esc(n.title) + '">进入 ›</button>';
    if (n.workspacePath) acts += '<button type="button" class="icon-btn folder-btn" data-act="open-dir" data-id="' + u.esc(n.id) + '">📁 复制路径</button>';
    acts += '<button type="button" class="icon-btn danger" data-act="delete" data-id="' + u.esc(n.id) + '">🗑 删除</button>';
    return '<div class="node-actions">' + acts + '</div>';
  }
  function renderNode(n, noKids) {
    const kids = Model.childrenOf(A().state.data, n.id);
    const editing = editingId === n.id, noteEditing = noteDraftId === n.id, isTask = n.type !== "domain";
    let html = '<div class="node" data-node="' + u.esc(n.id) + '">';
    if (editing) { html += nodeEditForm(n); }
    else {
      html += '<div class="node-row">'
        + (kids.length && !noKids ? '<button type="button" class="icon-btn" data-act="toggle" data-id="' + u.esc(n.id) + '" aria-label="' + (n.collapsed ? "展开" : "折叠") + '">' + (n.collapsed ? "▸" : "▾") + '</button>' : '<span style="min-width:38px"></span>')
        + (isTask ? '<input type="checkbox" class="check" data-act="check" data-id="' + u.esc(n.id) + '" aria-label="标记完成"' + (n.status === "done" ? " checked" : "") + '>' : '')
        + '<div style="flex:1;min-width:0">'
        + '<div class="node-title' + (n.status === "done" ? " done" : "") + '">' + u.esc(n.title) + ' ' + statusBadge(n) + '</div>'
        + (n.note && !noteEditing ? '<div class="node-note">' + u.esc(n.note) + '</div>' : '')
        + (n.workspacePath ? '<div class="att-ws">🗂 ' + u.esc(n.workspacePath) + '</div>' : '')
        + '<div class="node-meta">创建 ' + u.fmtTime(n.createdAt) + (n.completedAt ? ' · 完成 ' + u.fmtTime(n.completedAt) : '') + '</div>'
        + nodeActions(n)
        + (noteEditing ? noteEditor(n) : '')
        + renderAttachments(n)
        + (usbFormId === n.id ? usbForm(n) : '')
        + '</div></div>';
      if (!noKids && kids.length && !n.collapsed) {
        html += '<div class="node-children">';
        for (let i = 0; i < kids.length; i++) html += renderNode(kids[i]);
        html += '</div>';
      }
    }
    return html + '</div>';
  }
  function chips(filter) {
    return '<div class="chips">'
      + '<button type="button" class="chip' + (filter !== "notes" ? " on" : "") + '" data-act="tree-filter" data-filter="all">全部</button>'
      + '<button type="button" class="chip' + (filter === "notes" ? " on" : "") + '" data-act="tree-filter" data-filter="notes">只看有笔记</button>'
      + '</div>';
  }
  function renderNotesList(main) {
    const data = A().state.data;
    const list = data.nodes.filter(function (n) { return (n.note || "").trim(); });
    let html = chips("notes");
    if (!list.length) {
      html += '<div class="empty"><strong>暂无笔记</strong>在任务树中点「📝 笔记」写下想法，这里会汇总展示。</div>';
    } else {
      html += '<div class="tree">';
      list.forEach(function (n) {
        html += '<div class="node"><div class="node-title">' + u.esc(n.title) + ' ' + statusBadge(n) + '</div>'
          + '<div class="node-note">' + u.esc(n.note) + '</div>'
          + '<div class="node-actions"><button type="button" class="icon-btn" data-act="goto-node" data-id="' + u.esc(n.id) + '">🌳 查看任务</button></div>'
          + '</div>';
      });
      html += '</div>';
    }
    main.innerHTML = html;
  }

  function render(main) {
    const app = A();
    /* 从其他视图跳转过来的聚焦节点（一次性消费） */
    if (app.state.treeFocusId) {
      mobileFocusId = app.state.treeFocusId;
      app.state.treeFocusId = null;
    }
    const filter = app.state.treeFilter;
    if (filter === "notes") { renderNotesList(main); return; }
    const data = app.state.data;
    let html = chips("all");
    if (u.isNarrow()) {
      const focus = mobileFocusId ? Model.findNode(data, mobileFocusId) : null;
      if (focus) {
        html += '<div class="drill"><button type="button" class="icon-btn" data-act="back">‹ 返回</button>'
          + '<span class="crumb">' + u.esc(Model.crumbPath(data, focus.id).join(" › ")) + '</span></div>';
        html += '<div class="tree">' + renderNode(focus, true) + '</div>';
        const kids = Model.childrenOf(data, focus.id);
        if (!kids.length) html += '<div class="empty"><strong>暂无子项</strong>点击上方「＋子项」继续拆解。</div>';
        else {
          html += '<div class="tree">';
          kids.forEach(function (k) { html += renderNode(k); });
          html += '</div>';
        }
      } else {
        html += '<div class="tree">';
        Model.childrenOf(data, null).forEach(function (n) { html += renderNode(n); });
        html += '</div>';
      }
    } else {
      if (!data.nodes.length) {
        html += '<div class="empty"><strong>还没有任何领域</strong>点击下方「＋ 新建领域」开始拆解你的任务吧。</div>';
      } else {
        html += '<div class="tree">';
        Model.childrenOf(data, null).forEach(function (n) { html += renderNode(n); });
        html += '</div>';
      }
    }
    html += '<div class="add-root"><button type="button" class="btn" data-act="add-root">＋ 新建领域</button></div>';
    main.innerHTML = html;
    app.hydrateThumbs(main);
  }

  function onEvent(kind, el, ev) {
    const app = A();
    const data = app.state.data;
    const act = el.getAttribute ? el.getAttribute("data-act") : null;
    const id = el.getAttribute ? el.getAttribute("data-id") : null;

    if (kind === "click") {
      if (act === "tree-filter") { location.hash = el.getAttribute("data-filter") === "notes" ? "#/tree?filter=notes" : "#/tree"; return; }
      if (act === "toggle") { app.mutate(function (s) { const n = Model.findNode(s, id); if (n) n.collapsed = !n.collapsed; }, { type: "update", title: (Model.findNode(data, id) || {}).title }); return; }
      if (act === "add-child") {
        const title = window.prompt("子项名称：");
        if (title === null) return;
        const t = title.trim();
        if (!t) { app.toast("error", "名称不能为空"); return; }
        app.mutate(function (s) { Model.addNode(s, id, t, "task"); }, { type: "create", title: t });
        return;
      }
      if (act === "add-root") {
        const title = window.prompt("领域名称：");
        if (title === null) return;
        const t = title.trim();
        if (!t) { app.toast("error", "名称不能为空"); return; }
        app.mutate(function (s) { Model.addNode(s, null, t, "domain"); }, { type: "create", title: t });
        return;
      }
      if (act === "edit") { editingId = id; noteDraftId = null; app.render(); return; }
      if (act === "cancel-edit") { editingId = null; app.render(); return; }
      if (act === "note") { noteDraftId = (noteDraftId === id) ? null : id; editingId = null; app.render(); return; }
      if (act === "cancel-note") { noteDraftId = null; app.render(); return; }
      if (act === "upload") { app.openFilePicker(id); return; }
      if (act === "usb-form") { usbFormId = (usbFormId === id) ? null : id; app.render(); return; }
      if (act === "cancel-usb") { usbFormId = null; app.render(); return; }
      if (act === "open-dir") {
        const n = Model.findNode(data, id);
        if (n && n.workspacePath) {
          u.copyText(n.workspacePath).then(function () {
            app.toast("saved", "✅ 已复制路径，粘贴到文件资源管理器地址栏即可打开");
          });
        }
        return;
      }
      if (act === "star") {
        const n = Model.findNode(data, id);
        if (!n) return;
        const today = u.todayStr();
        app.mutate(function (s) { Model.toggleFocus(s, id, today); }, { type: "focus", n: 1 });
        return;
      }
      if (act === "ms-from-node") {
        const n = Model.findNode(data, id);
        if (!n) return;
        const title = window.prompt("里程碑名称：");
        if (title === null) return;
        const t = title.trim();
        if (!t) { app.toast("error", "名称不能为空"); return; }
        app.mutate(function (s) {
          Model.milestoneAdd(s, { title: t, date: u.todayStr(), note: "", nodeId: id });
        }, { type: "milestone-add", title: t });
        app.toast("saved", "✅ 已添加里程碑，可在「成长轨迹」查看");
        return;
      }
      if (act === "nav") { mobileFocusId = id; editingId = null; noteDraftId = null; app.render(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      if (act === "back") {
        if (!mobileFocusId) return;
        const n = Model.findNode(data, mobileFocusId);
        mobileFocusId = (n && n.parentId) ? n.parentId : null;
        editingId = null; noteDraftId = null; app.render();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (act === "goto-node") { app.gotoNode(id); return; }
      if (act === "att-open") { app.openAttachment(id, parseInt(el.getAttribute("data-idx"), 10)); return; }
      if (act === "att-del") {
        const n = Model.findNode(data, id);
        const idx = parseInt(el.getAttribute("data-idx"), 10);
        const att = n && (n.attachments || [])[idx];
        if (!att) return;
        if (!window.confirm("确定删除附件「" + (att.name || att.path || "") + "」吗？")) return;
        if (att.storage === "cloud" && att.path) {
          Store.deleteAttachment(att.path).catch(function () {
            app.toast("saving", "云端文件删除失败，已从记录中移除");
          });
        }
        app.mutate(function (s) {
          const nn = Model.findNode(s, id);
          if (nn && nn.attachments) nn.attachments.splice(idx, 1);
        }, { type: "attach-del", node: n.title, file: att.name || "" });
        return;
      }
      if (act === "delete") {
        const n = Model.findNode(data, id);
        if (!n) return;
        if (!window.confirm("确定删除「" + n.title + "」及其所有子项吗？")) return;
        const res = Model.deleteNode(structuredClone(data), id);
        app.mutate(function (s) { Model.deleteNode(s, id); }, { type: "delete", title: n.title });
        res.cloudAtts.forEach(function (p) {
          Store.deleteAttachment(p).catch(function () { /* 孤儿文件无害 */ });
        });
        if (mobileFocusId && !Model.findNode(app.state.data, mobileFocusId)) mobileFocusId = null;
        return;
      }
      return;
    }

    if (kind === "change") {
      if (act === "check") {
        const n = Model.findNode(data, id);
        if (!n) return;
        const done = el.checked;
        app.mutate(function (s) {
          Model.setStatus(s, id, done ? "done" : "todo");
        }, done ? { type: "done", title: n.title } : { type: "reopen", title: n.title });
      }
      return;
    }

    if (kind === "submit") {
      const form = el.getAttribute("data-form");
      if (form === "node-edit") {
        const fid = el.getAttribute("data-id");
        const n = Model.findNode(data, fid);
        if (!n) return;
        const title = el.querySelector('[name=title]').value.trim();
        if (!title) { app.toast("error", "名称不能为空"); return; }
        const note = el.querySelector('[name=note]').value;
        const ws = el.querySelector('[name=wspath]').value.trim();
        const sel = el.querySelector('[name=status]');
        const v = sel ? sel.value : null;
        const statusChanged = v && v !== n.status;
        app.mutate(function (s) {
          const nn = Model.findNode(s, fid);
          if (nn) {
            nn.title = title; nn.note = note; nn.workspacePath = ws;
            if (v) Model.setStatus(s, fid, v);
          }
        }, statusChanged ? statusOp(n.status, v, title) : { type: "update", title: title });
        editingId = null;
        return;
      }
      if (form === "note-edit") {
        const fid = el.getAttribute("data-id");
        const n = Model.findNode(data, fid);
        const text = el.querySelector('textarea[name=note]').value;
        app.mutate(function (s) {
          const nn = Model.findNode(s, fid);
          if (nn) nn.note = text;
        }, { type: "note", title: n ? n.title : "" });
        noteDraftId = null;
        app.render();
        return;
      }
      if (form === "usb-add") {
        const fid = el.getAttribute("data-id");
        const name = el.querySelector('[name=fname]').value.trim();
        const path = el.querySelector('[name=fpath]').value.trim();
        if (!name || !path) { app.toast("error", "文件名和 U 盘路径都要填写"); return; }
        app.attachUsb(fid, name, path);
        usbFormId = null;
        return;
      }
      return;
    }

    if (kind === "focusout") {
      const ta = el.closest ? el.closest('.note-editor textarea[name=note]') : null;
      if (!ta) return;
      const form = ta.closest(".note-editor");
      if (!form) return;
      const fid = form.getAttribute("data-id");
      const n = Model.findNode(data, fid);
      if (n && (n.note || "") === ta.value) return;
      app.mutate(function (s) {
        const nn = Model.findNode(s, fid);
        if (nn) nn.note = ta.value;
      }, { type: "note", title: n ? n.title : "" });
      app.toast("saved", "✅ 笔记已保存");
    }
  }

  global.LWB = global.LWB || {};
  global.LWB.views = global.LWB.views || {};
  global.LWB.views.tree = { render: render, onEvent: onEvent };
})(window);
