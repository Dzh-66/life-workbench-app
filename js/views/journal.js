/* 任务笔记工作台 - 日记视图（自绘月历 + 每日一句话 + 年度回看 + 去年今日） */
(function (global) {
  "use strict";
  const u = global.LWB.util;
  const Model = global.LWB.Model;
  const A = function () { return global.LWB.App; };

  /* 视图内部状态 */
  let viewYM = null;       // {y, m(0-11)}
  let selected = null;     // YYYY-MM-DD
  let editing = false, dMood = null;
  let yearMode = false;

  function ensureState() {
    const today = new Date();
    if (!viewYM) viewYM = { y: today.getFullYear(), m: today.getMonth() };
    if (!selected) selected = u.todayStr();
    const p = selected.split("-").map(Number);
    if (viewYM.y !== p[0] || viewYM.m !== p[1] - 1) viewYM = { y: p[0], m: p[1] - 1 };
  }

  function moodLabel(mood) { return mood && u.moodMap[mood] ? u.moodMap[mood].icon + " " + u.moodMap[mood].label : ""; }

  function editor(date, entry) {
    const text = entry ? entry.text : "";
    const mood = entry ? entry.mood : dMood;
    return '<form class="note-editor" data-form="j-save" data-date="' + date + '">'
      + '<textarea name="text" maxlength="2000" aria-label="日记内容" placeholder="这一天，写下一句话…">' + u.esc(text) + '</textarea>'
      + '<div class="row">'
      + Object.keys(u.moodMap).map(function (k) {
        return '<button type="button" class="mood-btn' + (mood === k ? " on" : "") + '" data-act="j-mood" data-mood="' + k + '" data-mood-prevent="1">' + u.moodMap[k].label + '</button>';
      }).join('')
      + '<button type="submit" class="btn">保存</button>'
      + '<button type="button" class="btn ghost" data-act="j-cancel">取消</button>'
      + '</div></form>';
  }

  function calendar(data) {
    const y = viewYM.y, m = viewYM.m;
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; /* 周一为一周第一天 */
    const today = u.todayStr();
    let html = '<div class="cal-nav">'
      + '<button type="button" class="icon-btn" data-act="j-prev">◀</button>'
      + '<span class="cal-title">' + y + '年' + (m + 1) + '月</span>'
      + '<button type="button" class="icon-btn" data-act="j-next">▶</button>'
      + '<button type="button" class="btn ghost year-btn' + (yearMode ? " on" : "") + '" data-act="j-year">年度回看</button>'
      + '</div>'
      + '<div class="cal-grid">'
      + ["一", "二", "三", "四", "五", "六", "日"].map(function (w) { return '<span class="cal-wd">' + w + '</span>'; }).join('');
    for (let i = 0; i < lead; i++) html += '<span class="cal-day blank"></span>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = y + "-" + u.pad(m + 1) + "-" + u.pad(d);
      const has = !!Model.journalGet(data, ds);
      const mood = has ? (Model.journalGet(data, ds).mood || "") : "";
      html += '<button type="button" class="cal-day' + (ds === selected ? " sel" : "") + (ds === today ? " today" : "") + '" data-act="j-day" data-date="' + ds + '">'
        + '<span class="cal-num">' + d + '</span>'
        + '<span class="cal-dot' + (mood ? " mood-" + mood : "") + (has ? " on" : "") + '"></span>'
        + '</button>';
    }
    return html + '</div>';
  }

  function yearReview(data) {
    const days = Model.journalDays(data);
    if (!days.length) {
      return '<div class="empty"><strong>这一年还没有日记</strong>每天一句话，年末回看一整年的心路。</div>';
    }
    const total = days.length;
    let good = 0, ok = 0, bad = 0;
    days.forEach(function (d) {
      const mood = Model.journalGet(data, d).mood;
      if (mood === "good") good++;
      else if (mood === "ok") ok++;
      else if (mood === "bad") bad++;
    });
    const best = good >= ok && good >= bad && good > 0 ? "😀 好" : (bad > good && bad > ok ? "😞 差" : (ok > 0 ? "🙂 还行" : "—"));
    /* 去年今日 */
    const yag = Model.journalYearAgo(data, u.todayStr());
    let html = '<div class="stats-row">'
      + '<div class="stat"><b>' + total + '</b><span>记录天数</span></div>'
      + '<div class="stat"><b>' + days.length + '</b><span>日记篇数</span></div>'
      + '<div class="stat"><b>' + best + '</b><span>最常见心情</span></div>'
      + '</div>';
    if (yag) {
      html += '<div class="yag-card">🕰 <b>去年今日</b>：' + u.esc(yag.text) + (yag.mood ? ' ' + u.moodMap[yag.mood].icon : '') + '</div>';
    }
    /* 按月份分组（倒序） */
    const byMonth = {};
    days.forEach(function (d) {
      const key = d.slice(0, 7);
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(d);
    });
    const months = Object.keys(byMonth).sort().reverse();
    months.forEach(function (mk) {
      const p = mk.split("-");
      html += '<div class="ym-group"><div class="ym-head">' + p[0] + '年' + parseInt(p[1], 10) + '月</div>';
      byMonth[mk].slice().reverse().forEach(function (d) {
        const en = Model.journalGet(data, d);
        html += '<div class="ym-entry"><span class="ym-date">' + u.esc(d) + '</span>'
          + '<span class="ym-text">' + u.esc(en.text) + '</span>'
          + (en.mood ? '<span class="ym-mood">' + u.moodMap[en.mood].icon + '</span>' : '')
          + '</div>';
      });
      html += '</div>';
    });
    return html;
  }

  function render(main) {
    ensureState();
    const app = A();
    const data = app.state.data;
    let html = calendar(data);
    if (yearMode) {
      html += yearReview(data);
    } else {
      const entry = Model.journalGet(data, selected);
      html += '<section class="card"><h2>' + u.esc(u.dateCN(selected)) + '</h2>';
      if (entry && !editing) {
        html += '<div class="journal-show"><div class="journal-text">' + u.esc(entry.text) + '</div>'
          + '<div class="journal-meta">' + moodLabel(entry.mood) + (entry.mood ? ' · ' : '') + '更新于 ' + u.fmtTime(entry.updatedAt) + '</div>'
          + '<div class="row-btns">'
          + '<button type="button" class="btn ghost" data-act="j-edit">✎ 编辑</button>'
          + '<button type="button" class="btn ghost danger-ghost" data-act="j-del">🗑 删除</button>'
          + '</div></div>';
      } else if (entry || editing) {
        html += editor(selected, entry);
      } else {
        html += '<div class="empty small"><strong>这一天还没有记录</strong></div>'
          + '<div class="row-btns"><button type="button" class="btn" data-act="j-write">＋ 写一句</button></div>';
      }
      html += '</section>';
    }
    main.innerHTML = html;
  }

  function onEvent(kind, el, ev) {
    const app = A();
    const data = app.state.data;
    const act = el.getAttribute ? el.getAttribute("data-act") : null;

    if (kind === "click") {
      if (act === "j-prev") {
        viewYM = { y: viewYM.y + (viewYM.m === 0 ? -1 : 0), m: viewYM.m === 0 ? 11 : viewYM.m - 1 };
        selected = viewYM.y + "-" + u.pad(viewYM.m + 1) + "-01";
        editing = false; dMood = null; app.render(); return;
      }
      if (act === "j-next") {
        viewYM = { y: viewYM.y + (viewYM.m === 11 ? 1 : 0), m: viewYM.m === 11 ? 0 : viewYM.m + 1 };
        selected = viewYM.y + "-" + u.pad(viewYM.m + 1) + "-01";
        editing = false; dMood = null; app.render(); return;
      }
      if (act === "j-day") {
        selected = el.getAttribute("data-date");
        const p = selected.split("-").map(Number);
        viewYM = { y: p[0], m: p[1] - 1 };
        editing = false; dMood = null; app.render(); return;
      }
      if (act === "j-year") { yearMode = !yearMode; editing = false; dMood = null; app.render(); return; }
      if (act === "j-write" || act === "j-edit") { editing = true; dMood = null; app.render(); return; }
      if (act === "j-cancel") { editing = false; dMood = null; app.render(); return; }
      if (act === "j-mood") {
        /* 不整页重渲染（避免丢失正在输入的草稿），只切换按钮样式 */
        dMood = (dMood === el.getAttribute("data-mood")) ? null : el.getAttribute("data-mood");
        const form = el.closest("form");
        if (form) {
          form.querySelectorAll(".mood-btn").forEach(function (b) {
            b.classList.toggle("on", b.getAttribute("data-mood") === dMood);
          });
        }
        return;
      }
      if (act === "j-del") {
        const entry = Model.journalGet(data, selected);
        if (!entry) return;
        if (!window.confirm("确定删除 " + selected + " 的日记吗？")) return;
        app.mutate(function (s) { Model.journalDel(s, selected); }, { type: "journal", date: selected });
        editing = false;
        return;
      }
      return;
    }

    if (kind === "submit") {
      if (el.getAttribute("data-form") === "j-save") {
        const date = el.getAttribute("data-date");
        const text = el.querySelector('textarea[name=text]').value.trim();
        if (!text) { app.toast("error", "写一句话再保存吧"); return; }
        app.mutate(function (s) { Model.journalSet(s, date, text, dMood); }, { type: "journal", date: date });
        editing = false; dMood = null;
        app.toast("saved", "✅ 已保存");
        return;
      }
      return;
    }

    if (kind === "focusout") {
      const ta = el.closest ? el.closest('form[data-form=j-save] textarea[name=text]') : null;
      if (!ta) return;
      const form = ta.closest("form[data-form=j-save]");
      const date = form.getAttribute("data-date");
      const text = ta.value.trim();
      const cur = Model.journalGet(data, date);
      if (text && (!cur || cur.text !== text)) {
        app.mutate(function (s) { Model.journalSet(s, date, text, dMood); }, { type: "journal", date: date });
        app.toast("saved", "✅ 已保存");
      }
      editing = false; dMood = null;
    }
  }

  global.LWB = global.LWB || {};
  global.LWB.views = global.LWB.views || {};
  global.LWB.views.journal = { render: render, onEvent: onEvent };
})(window);
