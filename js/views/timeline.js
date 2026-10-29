/* 任务笔记工作台 - 成长轨迹视图（任务创建/完成 + 里程碑合并时间线） */
(function (global) {
  "use strict";
  const u = global.LWB.util;
  const Model = global.LWB.Model;
  const A = function () { return global.LWB.App; };

  /* 视图内部状态 */
  let filter = "all";      // all | task | milestone
  let msFormOpen = false, editingMsId = null;

  function milestoneForm(m, isEdit) {
    return '<form class="node-edit" data-form="' + (isEdit ? "ms-edit" : "ms-add") + '" data-id="' + u.esc(m ? m.id : "") + '">'
      + '<input type="text" name="title" maxlength="120" aria-label="里程碑名称" placeholder="里程碑名称" value="' + u.esc(m ? m.title : "") + '">'
      + '<input type="date" name="date" value="' + u.esc(m ? m.date : u.todayStr()) + '" aria-label="日期">'
      + '<textarea name="note" maxlength="1000" aria-label="备注" placeholder="备注（可选）">' + u.esc(m ? (m.note || "") : "") + '</textarea>'
      + '<div class="row"><button type="submit" class="btn">' + (isEdit ? "保存" : "添加") + '</button>'
      + '<button type="button" class="btn ghost" data-act="ms-cancel">取消</button></div>'
      + '</form>';
  }

  function milestoneItem(m, app) {
    const linked = m.nodeId ? Model.findNode(app.state.data, m.nodeId) : null;
    let html = '<div class="tl-item ms-item">'
      + '<span class="tl-dot gold"></span>'
      + '<div class="tl-main">'
      + '<div class="tl-head"><span class="ms-icon">🏆</span><strong>' + u.esc(m.title) + '</strong>'
      + '<span class="badge milestone">' + u.esc(m.date) + '</span></div>'
      + (m.note ? '<div class="node-note">' + u.esc(m.note) + '</div>' : '')
      + (linked ? '<div class="tl-link">关联任务：' + u.esc(linked.title) + '</div>' : '')
      + '<div class="node-actions">'
      + '<button type="button" class="icon-btn" data-act="ms-edit" data-id="' + u.esc(m.id) + '">✎ 编辑</button>'
      + '<button type="button" class="icon-btn danger" data-act="ms-del" data-id="' + u.esc(m.id) + '">🗑 删除</button>'
      + (linked ? '<button type="button" class="icon-btn" data-act="goto-node" data-id="' + u.esc(linked.id) + '">🌳 查看任务</button>' : '')
      + '</div>'
      + '</div></div>';
    return html;
  }

  function taskItem(e, app) {
    const isDone = e.kind === "complete";
    return '<div class="tl-item"><span class="tl-dot' + (isDone ? "" : " pink") + '"></span>'
      + '<div class="tl-main"><div>' + (isDone ? '✅ 完成了 <strong>' + u.esc(e.node.title) + '</strong>' : '🌱 创建了 <strong>' + u.esc(e.node.title) + '</strong>') + '</div>'
      + '<div class="tl-time">' + u.fmtTime(e.t) + '</div>'
      + '<div class="node-actions"><button type="button" class="icon-btn" data-act="goto-node" data-id="' + u.esc(e.node.id) + '">🌳 查看任务</button></div>'
      + '</div></div>';
  }

  function render(main) {
    const app = A();
    const data = app.state.data;
    let events = Model.timelineEvents(data);
    if (filter === "task") events = events.filter(function (e) { return e.kind !== "milestone"; });
    if (filter === "milestone") events = events.filter(function (e) { return e.kind === "milestone"; });

    let html = '<div class="chips">'
      + '<button type="button" class="chip' + (filter === "all" ? " on" : "") + '" data-act="tl-filter" data-filter="all">全部</button>'
      + '<button type="button" class="chip' + (filter === "task" ? " on" : "") + '" data-act="tl-filter" data-filter="task">任务</button>'
      + '<button type="button" class="chip' + (filter === "milestone" ? " on" : "") + '" data-act="tl-filter" data-filter="milestone">里程碑</button>'
      + '<button type="button" class="btn add-ms" data-act="ms-form">＋ 里程碑</button>'
      + '</div>';

    if (msFormOpen) html += '<div class="card">' + milestoneForm(null, false) + '</div>';

    if (!events.length) {
      html += '<div class="empty"><strong>暂无轨迹</strong>创建或完成任务、记录里程碑后，这里会留下你的成长足迹。</div>';
    } else {
      html += '<div class="timeline">';
      events.forEach(function (e) {
        if (e.kind === "milestone") {
          html += (editingMsId === e.milestone.id) ? '<div class="card">' + milestoneForm(e.milestone, true) + '</div>' : milestoneItem(e.milestone, app);
        } else {
          html += taskItem(e, app);
        }
      });
      html += '</div>';
    }
    main.innerHTML = html;
  }

  function onEvent(kind, el, ev) {
    const app = A();
    const data = app.state.data;
    const act = el.getAttribute ? el.getAttribute("data-act") : null;
    const id = el.getAttribute ? el.getAttribute("data-id") : null;

    if (kind === "click") {
      if (act === "tl-filter") { filter = el.getAttribute("data-filter"); app.render(); return; }
      if (act === "ms-form") { msFormOpen = true; editingMsId = null; app.render(); return; }
      if (act === "ms-cancel") { msFormOpen = false; editingMsId = null; app.render(); return; }
      if (act === "ms-edit") { editingMsId = id; msFormOpen = false; app.render(); return; }
      if (act === "ms-del") {
        const m = Model.findMilestone(data, id);
        if (!m) return;
        if (!window.confirm("确定删除里程碑「" + m.title + "」吗？")) return;
        app.mutate(function (s) { Model.milestoneDelete(s, id); }, { type: "milestone-del", title: m.title });
        return;
      }
      if (act === "goto-node") { app.gotoNode(id); return; }
      return;
    }

    if (kind === "submit") {
      const form = el.getAttribute("data-form");
      if (form === "ms-add") {
        const title = el.querySelector('[name=title]').value.trim();
        const date = el.querySelector('[name=date]').value || u.todayStr();
        const note = el.querySelector('[name=note]').value.trim();
        if (!title) { app.toast("error", "里程碑名称不能为空"); return; }
        app.mutate(function (s) { Model.milestoneAdd(s, { title: title, date: date, note: note, nodeId: null }); }, { type: "milestone-add", title: title });
        msFormOpen = false;
        app.toast("saved", "✅ 里程碑已记录");
        return;
      }
      if (form === "ms-edit") {
        const m = Model.findMilestone(data, id);
        const title = el.querySelector('[name=title]').value.trim();
        const date = el.querySelector('[name=date]').value || u.todayStr();
        const note = el.querySelector('[name=note]').value.trim();
        if (!title) { app.toast("error", "里程碑名称不能为空"); return; }
        app.mutate(function (s) { Model.milestoneUpdate(s, id, { title: title, date: date, note: note }); }, { type: "milestone-update", title: title });
        editingMsId = null;
        return;
      }
      return;
    }
  }

  global.LWB = global.LWB || {};
  global.LWB.views = global.LWB.views || {};
  global.LWB.views.timeline = { render: render, onEvent: onEvent };
})(window);
