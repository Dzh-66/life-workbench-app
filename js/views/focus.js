/* 任务笔记工作台 - 今日焦点视图（默认首页：焦点任务/习惯打卡/每日一句话/今日里程碑） */
(function (global) {
  "use strict";
  const u = global.LWB.util;
  const Model = global.LWB.Model;
  const A = function () { return global.LWB.App; };

  /* 视图内部状态 */
  let pickerOpen = false, pickerSel = new Set();
  let habitFormOpen = false, msFormOpen = false;
  let journalEdit = false, jMood = null;

  function statusOp(prev, next, title) {
    if (next === "done") return { type: "done", title: title };
    if (next === "inprogress") return { type: "start", title: title };
    if (prev === "done") return { type: "reopen", title: title };
    return { type: "update", title: title };
  }
  function statusBadge(n) {
    const map = { todo: "待办", inprogress: "进行中", done: "已完成" };
    return '<button type="button" class="badge ' + u.esc(n.status || "todo") + ' badge-btn" data-act="cycle-status" data-id="' + u.esc(n.id) + '">' + u.esc(map[n.status] || "待办") + '</button>';
  }

  function focusRow(n, app) {
    const crumb = Model.crumbPath(app.state.data, n.id).slice(0, -1).join(" › ");
    return '<div class="focus-row">'
      + '<input type="checkbox" class="check" data-act="check" data-id="' + u.esc(n.id) + '" aria-label="标记完成"' + (n.status === "done" ? " checked" : "") + '>'
      + '<div class="focus-main">'
      + '<div class="node-title' + (n.status === "done" ? " done" : "") + '">' + u.esc(n.title) + ' ' + statusBadge(n) + '</div>'
      + (crumb ? '<div class="focus-crumb">' + u.esc(crumb) + '</div>' : '')
      + (n.note ? '<div class="node-note">' + u.esc(n.note) + '</div>' : '')
      + '</div>'
      + '<button type="button" class="icon-btn danger" data-act="focus-remove" data-id="' + u.esc(n.id) + '" title="移出今日焦点">✕</button>'
      + '</div>';
  }

  function habitCard(h, today) {
    const st = Model.streak(h, today);
    const total = h.dates.length;
    let dots = "";
    for (let i = 6; i >= 0; i--) {
      const d = u.addDays(today, -i);
      const on = Model.habitChecked(h, d);
      dots += '<span class="h-dot' + (on ? " on" : "") + '" title="' + u.esc(d) + (on ? " 已打卡" : "") + '" style="' + (on ? "background:" + h.color + ";box-shadow:0 0 6px " + h.color : "") + '"></span>';
    }
    const checkedToday = Model.habitChecked(h, today);
    return '<div class="habit-card">'
      + '<div class="habit-head">'
      + '<span class="habit-dot" style="background:' + u.esc(h.color) + '"></span>'
      + '<span class="habit-title">' + u.esc(h.title) + '</span>'
      + '<button type="button" class="icon-btn danger habit-del" data-act="habit-del" data-id="' + u.esc(h.id) + '" title="删除习惯">🗑</button>'
      + '</div>'
      + '<div class="habit-stats">🔥 连续 <b>' + st.current + '</b> 天 · 共 ' + total + ' 次' + (st.longest > st.current ? ' · 最长 ' + st.longest + ' 天' : '') + '</div>'
      + '<div class="habit-week">' + dots + '</div>'
      + '<button type="button" class="btn habit-check' + (checkedToday ? " checked" : "") + '" data-act="habit-toggle" data-id="' + u.esc(h.id) + '">' + (checkedToday ? "✓ 今日已打卡（点击取消）" : "☑ 今日打卡") + '</button>'
      + '</div>';
  }

  function milestoneCard(m) {
    return '<div class="ms-card">'
      + '<div class="ms-head"><span class="ms-icon">🏆</span><span class="ms-title">' + u.esc(m.title) + '</span>'
      + '<span class="badge milestone">' + u.esc(m.date) + '</span></div>'
      + (m.note ? '<div class="node-note">' + u.esc(m.note) + '</div>' : '')
      + '</div>';
  }

  function render(main) {
    const app = A();
    const data = app.state.data;
    const today = u.todayStr();
    const focusList = Model.focusForToday(data, today);
    const carry = Model.carryover(data, today);
    const todayMs = data.milestones.filter(function (m) { return m.date === today; });
    const journal = Model.journalGet(data, today);
    const allDone = focusList.length > 0 && focusList.every(function (n) { return n.status === "done"; });

    let html = '<div class="focus-date">' + u.dateCN(today) + '</div>';

    /* 庆祝横幅 */
    if (allDone) {
      html += '<div class="celebrate">🎉 今日焦点全部完成！</div>';
    }

    /* 今日焦点任务 */
    html += '<section class="card"><h2>🎯 今日任务焦点 <span class="count">' + focusList.length + '</span></h2>';
    if (focusList.length) {
      html += '<div class="focus-list">';
      focusList.forEach(function (n) { html += focusRow(n, app); });
      html += '</div>';
    } else {
      html += '<div class="empty small"><strong>今天还没有焦点任务</strong>点下方按钮，把今天要做的事加进来</div>';
    }
    html += '<div class="row-btns"><button type="button" class="btn" data-act="focus-picker">＋ 添加焦点</button></div>';
    if (pickerOpen) {
      const candidates = data.nodes.filter(function (n) { return n.status !== "done" && (n.focusDates || []).indexOf(today) === -1; });
      html += '<div class="picker">';
      if (!candidates.length) {
        html += '<div class="empty small">没有可添加的任务（都是已完成或已在焦点中）</div>';
      } else {
        candidates.forEach(function (n) {
          const depth = Model.depth(data, n.id);
          const crumb = Model.crumbPath(data, n.id).slice(0, -1).join(" › ");
          const on = pickerSel.has(n.id);
          html += '<label class="picker-row" style="padding-left:' + (12 + depth * 18) + 'px">'
            + '<input type="checkbox" data-act="picker-toggle" data-id="' + u.esc(n.id) + '"' + (on ? " checked" : "") + '>'
            + '<span class="picker-title">' + u.esc(n.title) + '</span>'
            + (crumb ? '<span class="picker-crumb">' + u.esc(crumb) + '</span>' : '')
            + '</label>';
        });
        html += '<div class="row-btns">'
          + '<button type="button" class="btn" data-act="picker-confirm">加入今日焦点</button>'
          + '<button type="button" class="btn ghost" data-act="picker-cancel">取消</button>'
          + '</div>';
      }
      html += '</div>';
    }
    html += '</section>';

    /* 昨日未完成承接 */
    if (carry.length) {
      html += '<section class="card"><h2>⏪ 昨日焦点未完成</h2><div class="carry-list">';
      carry.forEach(function (n) {
        html += '<div class="carry-row"><span class="carry-title">' + u.esc(n.title) + '</span>'
          + '<button type="button" class="icon-btn" data-act="carryover-move" data-id="' + u.esc(n.id) + '">移到今天</button></div>';
      });
      html += '</div></section>';
    }

    /* 习惯打卡 */
    html += '<section class="card"><h2>🔥 习惯打卡</h2>';
    if (data.habits.length) {
      html += '<div class="habit-list">';
      data.habits.forEach(function (h) { html += habitCard(h, today); });
      html += '</div>';
    } else {
      html += '<div class="empty small"><strong>还没有习惯</strong>添加一个想每天坚持的小习惯吧</div>';
    }
    html += '<div class="row-btns"><button type="button" class="btn" data-act="habit-form">＋ 新习惯</button></div>';
    if (habitFormOpen) {
      html += '<form class="node-edit" data-form="habit-add">'
        + '<input type="text" name="title" maxlength="40" aria-label="习惯名称" placeholder="习惯名称（如 背单词 / 锻炼 / 早睡）">'
        + '<div class="row"><button type="submit" class="btn">添加</button>'
        + '<button type="button" class="btn ghost" data-act="habit-cancel">取消</button></div>'
        + '</form>';
    }
    html += '</section>';

    /* 每日一句话 */
    html += '<section class="card"><h2>📔 每日一句话</h2>';
    if (journal && !journalEdit) {
      html += '<div class="journal-show"><div class="journal-text">' + u.esc(journal.text) + '</div>'
        + '<div class="journal-meta">' + (journal.mood ? u.moodMap[journal.mood].icon + ' ' + u.moodMap[journal.mood].label : "未记录心情") + ' · ' + u.fmtTime(journal.updatedAt) + '</div>'
        + '<div class="row-btns"><button type="button" class="btn ghost" data-act="journal-edit">✎ 编辑</button></div></div>';
    } else {
      const editing = journalEdit || !journal;
      const text = journal ? journal.text : "";
      const mood = journal ? journal.mood : jMood;
      if (editing) {
        html += '<form class="note-editor" data-form="journal-save" data-date="' + today + '">'
          + '<textarea name="text" maxlength="2000" aria-label="今日一句话" placeholder="今天发生了什么？一句话记录此刻…">' + u.esc(text) + '</textarea>'
          + '<div class="row">'
          + Object.keys(u.moodMap).map(function (k) {
            return '<button type="button" class="mood-btn' + (mood === k ? " on" : "") + '" data-act="journal-mood" data-mood="' + k + '" data-mood-prevent="1">' + u.moodMap[k].label + '</button>';
          }).join('')
          + '<button type="submit" class="btn">保存</button>'
          + (journal ? '<button type="button" class="btn ghost" data-act="journal-cancel">取消</button>' : '')
          + '</div></form>';
      }
    }
    html += '</section>';

    /* 今日里程碑 */
    html += '<section class="card"><h2>🏆 今日里程碑</h2>';
    if (todayMs.length) {
      html += '<div class="ms-list">';
      todayMs.forEach(function (m) { html += milestoneCard(m); });
      html += '</div>';
    }
    html += '<div class="row-btns"><button type="button" class="btn" data-act="ms-form">＋ 里程碑</button></div>';
    if (msFormOpen) {
      html += '<form class="node-edit" data-form="ms-add">'
        + '<input type="text" name="title" maxlength="120" aria-label="里程碑名称" placeholder="里程碑名称（如 六级词汇过完一遍）">'
        + '<input type="date" name="date" value="' + today + '" aria-label="日期">'
        + '<textarea name="note" maxlength="1000" aria-label="备注" placeholder="备注（可选）"></textarea>'
        + '<div class="row"><button type="submit" class="btn">添加</button>'
        + '<button type="button" class="btn ghost" data-act="ms-cancel">取消</button></div>'
        + '</form>';
    }
    html += '</section>';

    main.innerHTML = html;
  }

  function onEvent(kind, el, ev) {
    const app = A();
    const data = app.state.data;
    const today = u.todayStr();
    const act = el.getAttribute ? el.getAttribute("data-act") : null;
    const id = el.getAttribute ? el.getAttribute("data-id") : null;

    if (kind === "click") {
      if (act === "check") return; /* change 事件处理 */
      if (act === "cycle-status") {
        const n = Model.findNode(data, id);
        if (!n) return;
        const order = ["todo", "inprogress", "done"];
        const next = order[(order.indexOf(n.status) + 1) % order.length];
        app.mutate(function (s) { Model.setStatus(s, id, next); }, statusOp(n.status, next, n.title));
        return;
      }
      if (act === "focus-remove") {
        app.mutate(function (s) { Model.toggleFocus(s, id, today); }, { type: "focus", n: 1 });
        return;
      }
      if (act === "focus-picker") { pickerOpen = true; pickerSel = new Set(); app.render(); return; }
      if (act === "picker-cancel") { pickerOpen = false; pickerSel = new Set(); app.render(); return; }
      if (act === "picker-toggle") return; /* change 事件处理 */
      if (act === "picker-confirm") {
        const sel = Array.from(pickerSel);
        if (!sel.length) { app.toast("error", "先勾选要加入焦点的任务"); return; }
        const n = sel.length;
        app.mutate(function (s) {
          sel.forEach(function (nid) { Model.toggleFocus(s, nid, today); });
        }, { type: "focus", n: n });
        pickerOpen = false; pickerSel = new Set();
        return;
      }
      if (act === "carryover-move") {
        app.mutate(function (s) { Model.toggleFocus(s, id, today); }, { type: "focus", n: 1 });
        return;
      }
      if (act === "habit-form") { habitFormOpen = true; app.render(); return; }
      if (act === "habit-cancel") { habitFormOpen = false; app.render(); return; }
      if (act === "habit-toggle") {
        const h = Model.findHabit(data, id);
        if (!h) return;
        const wasOn = Model.habitChecked(h, today);
        app.mutate(function (s) { Model.habitToggle(s, id, today); },
          wasOn ? { type: "uncheckin", title: h.title } : { type: "checkin", title: h.title });
        return;
      }
      if (act === "habit-del") {
        const h = Model.findHabit(data, id);
        if (!h) return;
        if (!window.confirm("确定删除习惯「" + h.title + "」吗？（打卡记录会一并删除）")) return;
        app.mutate(function (s) { s.habits = s.habits.filter(function (x) { return x.id !== id; }); }, { type: "habit-del", title: h.title });
        return;
      }
      if (act === "journal-edit") { journalEdit = true; jMood = null; app.render(); return; }
      if (act === "journal-cancel") { journalEdit = false; jMood = null; app.render(); return; }
      if (act === "journal-mood") {
        /* 不整页重渲染（避免丢失正在输入的草稿），只切换按钮样式 */
        jMood = (jMood === el.getAttribute("data-mood")) ? null : el.getAttribute("data-mood");
        const form = el.closest("form");
        if (form) {
          form.querySelectorAll(".mood-btn").forEach(function (b) {
            b.classList.toggle("on", b.getAttribute("data-mood") === jMood);
          });
        }
        return;
      }
      if (act === "ms-form") { msFormOpen = true; app.render(); return; }
      if (act === "ms-cancel") { msFormOpen = false; app.render(); return; }
      return;
    }

    if (kind === "change") {
      if (act === "check") {
        const n = Model.findNode(data, id);
        if (!n) return;
        const done = el.checked;
        app.mutate(function (s) { Model.setStatus(s, id, done ? "done" : "todo"); },
          done ? { type: "done", title: n.title } : { type: "reopen", title: n.title });
        return;
      }
      if (act === "picker-toggle") {
        if (el.checked) pickerSel.add(id); else pickerSel.delete(id);
        return;
      }
      return;
    }

    if (kind === "submit") {
      const form = el.getAttribute("data-form");
      if (form === "habit-add") {
        const title = el.querySelector('[name=title]').value.trim();
        if (!title) { app.toast("error", "习惯名称不能为空"); return; }
        app.mutate(function (s) { Model.habitAdd(s, title); }, { type: "habit-add", title: title });
        habitFormOpen = false;
        return;
      }
      if (form === "journal-save") {
        const date = el.getAttribute("data-date");
        const text = el.querySelector('textarea[name=text]').value.trim();
        if (!text) { app.toast("error", "写一句话再保存吧"); return; }
        app.mutate(function (s) { Model.journalSet(s, date, text, jMood); }, { type: "journal", date: date });
        journalEdit = false; jMood = null;
        app.toast("saved", "✅ 已记录今天");
        return;
      }
      if (form === "ms-add") {
        const title = el.querySelector('[name=title]').value.trim();
        const date = el.querySelector('[name=date]').value || today;
        const note = el.querySelector('[name=note]').value.trim();
        if (!title) { app.toast("error", "里程碑名称不能为空"); return; }
        app.mutate(function (s) { Model.milestoneAdd(s, { title: title, date: date, note: note, nodeId: null }); }, { type: "milestone-add", title: title });
        msFormOpen = false;
        app.toast("saved", "✅ 里程碑已记录");
        return;
      }
      return;
    }

    if (kind === "focusout") {
      const ta = el.closest ? el.closest('form[data-form=journal-save] textarea[name=text]') : null;
      if (!ta) return;
      const form = ta.closest("form[data-form=journal-save]");
      const date = form.getAttribute("data-date");
      const text = ta.value.trim();
      const cur = Model.journalGet(data, date);
      if (text && (!cur || cur.text !== text)) {
        app.mutate(function (s) { Model.journalSet(s, date, text, jMood); }, { type: "journal", date: date });
        app.toast("saved", "✅ 已记录");
      }
      journalEdit = false; jMood = null;
    }
  }

  global.LWB = global.LWB || {};
  global.LWB.views = global.LWB.views || {};
  global.LWB.views.focus = { render: render, onEvent: onEvent };
})(window);
