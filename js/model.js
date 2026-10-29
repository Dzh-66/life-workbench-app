/* 任务笔记工作台 - 数据模型与纯数据操作（今日焦点/习惯/里程碑/日记/时间线推导） */
(function (global) {
  "use strict";
  const u = global.LWB.util;
  const M = {};

  M.empty = function () {
    return {
      schemaVersion: 1, nodes: [], milestones: [], habits: [], journals: {},
      preferences: { owner: null, repo: null, defaultView: "focus", lastSyncAt: null }
    };
  };

  /* 按 schemaVersion 逐级升级；v1 为基线，字段只增不改 */
  M.migrate = function (data) {
    data = (data && typeof data === "object") ? data : {};
    if (!Array.isArray(data.nodes)) data.nodes = [];
    data.nodes.forEach(function (n) {
      if (!n.focusDates) n.focusDates = [];
      if (!n.attachments) n.attachments = [];
      if (!n.status) n.status = "todo";
    });
    if (!Array.isArray(data.milestones)) data.milestones = [];
    if (!Array.isArray(data.habits)) data.habits = [];
    if (!data.journals || typeof data.journals !== "object") data.journals = {};
    if (!data.preferences || typeof data.preferences !== "object") data.preferences = {};
    if (!data.preferences.defaultView) data.preferences.defaultView = "focus";
    data.schemaVersion = data.schemaVersion || 1;
    return data;
  };

  M.counts = function (data) {
    return { nodes: (data.nodes || []).length, milestones: (data.milestones || []).length, habits: (data.habits || []).length, journals: Object.keys(data.journals || {}).length };
  };

  /* ── 任务树 ── */
  M.findNode = function (data, id) {
    for (let i = 0; i < data.nodes.length; i++) if (data.nodes[i].id === id) return data.nodes[i];
    return null;
  };
  M.childrenOf = function (data, pid) {
    return data.nodes.filter(function (n) { return n.parentId === pid; }).sort(function (a, b) { return (a.createdAt || "").localeCompare(b.createdAt || ""); });
  };
  M.descendants = function (data, id) {
    const out = [], stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      data.nodes.forEach(function (n) { if (n.parentId === cur) { out.push(n); stack.push(n.id); } });
    }
    return out;
  };
  M.crumbPath = function (data, id) {
    const out = [], seen = new Set();
    let cur = M.findNode(data, id);
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id); out.unshift(cur.title);
      cur = cur.parentId ? M.findNode(data, cur.parentId) : null;
    }
    return out;
  };
  /* 深度（顶层=0），用于焦点选择器缩进 */
  M.depth = function (data, id) {
    let d = 0, cur = M.findNode(data, id);
    while (cur && cur.parentId) { d++; cur = M.findNode(data, cur.parentId); }
    return d;
  };

  M.addNode = function (data, parentId, title, type) {
    const node = {
      id: u.newId("n"), parentId: parentId, title: title, type: type || "task", status: "todo",
      note: "", createdAt: new Date().toISOString(), completedAt: null, collapsed: false,
      attachments: [], workspacePath: "", focusDates: []
    };
    data.nodes.push(node);
    const p = M.findNode(data, parentId);
    if (p) p.collapsed = false;
    return node;
  };

  M.updateNode = function (data, id, patch) {
    const n = M.findNode(data, id);
    if (!n) return null;
    for (const k in patch) n[k] = patch[k];
    return n;
  };

  /* 状态变更（含 completedAt 维护与祖先自动完成） */
  M.setStatus = function (data, id, status) {
    const n = M.findNode(data, id);
    if (!n) return null;
    const prev = n.status;
    n.status = status;
    if (status === "done" && prev !== "done") n.completedAt = new Date().toISOString();
    if (status !== "done" && prev === "done") n.completedAt = null;
    if (status === "done") M._markAncestors(data, n.parentId);
    return { prev: prev, node: n };
  };
  M._markAncestors = function (data, pid) {
    while (pid) {
      const p = M.findNode(data, pid);
      if (!p) break;
      const kids = M.childrenOf(data, p.id);
      const allDone = kids.length > 0 && kids.every(function (k) { return k.status === "done"; });
      if (allDone) { p.status = "done"; p.completedAt = new Date().toISOString(); pid = p.parentId; }
      else break;
    }
  };

  M.deleteNode = function (data, id) {
    const ids = M.descendants(data, id); ids.push(id);
    const cloudAtts = [];
    data.nodes.filter(function (n) { return ids.indexOf(n.id) > -1; }).forEach(function (n) {
      (n.attachments || []).forEach(function (a) { if (a.storage === "cloud" && a.path) cloudAtts.push(a.path); });
    });
    const removed = data.nodes.filter(function (n) { return ids.indexOf(n.id) > -1; });
    data.nodes = data.nodes.filter(function (n) { return ids.indexOf(n.id) === -1; });
    return { removed: removed, cloudAtts: cloudAtts };
  };

  /* ── 今日焦点 ── */
  M.focusForToday = function (data, dateStr) {
    return data.nodes.filter(function (n) { return (n.focusDates || []).indexOf(dateStr) > -1; })
      .sort(function (a, b) { return (a.createdAt || "").localeCompare(b.createdAt || ""); });
  };
  M.toggleFocus = function (data, id, dateStr) {
    const n = M.findNode(data, id);
    if (!n) return 0;
    if (!n.focusDates) n.focusDates = [];
    const i = n.focusDates.indexOf(dateStr);
    if (i > -1) n.focusDates.splice(i, 1); else n.focusDates.push(dateStr);
    n.focusDates.sort();
    return n.focusDates.length;
  };
  /* 昨日焦点未完成：focusDates 最大日期早于今天且未完成 */
  M.carryover = function (data, today) {
    return data.nodes.filter(function (n) {
      const fd = n.focusDates || [];
      if (!fd.length || n.status === "done") return false;
      return fd[fd.length - 1] < today;
    });
  };
  /* 保存前清理 30 天前的焦点日期 */
  M.pruneFocusDates = function (data, today) {
    const cutoff = u.addDays(today, -30);
    data.nodes.forEach(function (n) {
      if (n.focusDates) n.focusDates = n.focusDates.filter(function (d) { return d >= cutoff; });
    });
  };

  /* ── 习惯 ── */
  M.habitColors = ["#00f0ff", "#ff2bd6", "#39ff88", "#ffd94f", "#b04fff"];
  M.findHabit = function (data, id) {
    for (let i = 0; i < data.habits.length; i++) if (data.habits[i].id === id) return data.habits[i];
    return null;
  };
  M.habitAdd = function (data, title) {
    const h = { id: u.newId("h"), title: title, dates: [], color: M.habitColors[data.habits.length % M.habitColors.length], createdAt: new Date().toISOString() };
    data.habits.push(h);
    return h;
  };
  M.habitToggle = function (data, id, dateStr) {
    const h = M.findHabit(data, id);
    if (!h) return null;
    const i = h.dates.indexOf(dateStr);
    if (i > -1) h.dates.splice(i, 1); else { h.dates.push(dateStr); h.dates.sort(); }
    return h;
  };
  M.habitChecked = function (h, dateStr) { return (h.dates || []).indexOf(dateStr) > -1; };
  /* 连续天数：今天未打卡则从昨天起算（今天还有机会）；longest 为历史最长连续 */
  M.streak = function (h, refStr) {
    const set = new Set(h.dates || []);
    let cur = 0, d = refStr;
    if (!set.has(d)) d = u.addDays(d, -1);
    while (set.has(d)) { cur++; d = u.addDays(d, -1); }
    let longest = 0, run = 0, prev = null;
    Array.from(set).sort().forEach(function (ds) {
      run = (prev && u.addDays(prev, 1) === ds) ? run + 1 : 1;
      if (run > longest) longest = run;
      prev = ds;
    });
    return { current: cur, longest: longest };
  };

  /* ── 里程碑 ── */
  M.findMilestone = function (data, id) {
    for (let i = 0; i < data.milestones.length; i++) if (data.milestones[i].id === id) return data.milestones[i];
    return null;
  };
  M.milestoneAdd = function (data, patch) {
    const m = { id: u.newId("m"), date: patch.date || u.todayStr(), title: patch.title || "", note: patch.note || "", nodeId: patch.nodeId || null, createdAt: new Date().toISOString() };
    data.milestones.push(m);
    return m;
  };
  M.milestoneUpdate = function (data, id, patch) {
    const m = M.findMilestone(data, id);
    if (m) for (const k in patch) m[k] = patch[k];
    return m;
  };
  M.milestoneDelete = function (data, id) {
    data.milestones = data.milestones.filter(function (x) { return x.id !== id; });
  };

  /* ── 日记（每日一句话） ── */
  M.journalGet = function (data, dateStr) { return (data.journals || {})[dateStr] || null; };
  M.journalSet = function (data, dateStr, text, mood) {
    data.journals[dateStr] = { text: text, mood: mood || null, updatedAt: new Date().toISOString() };
  };
  M.journalDel = function (data, dateStr) { delete data.journals[dateStr]; };
  M.journalDays = function (data) { return Object.keys(data.journals || {}).sort(); };
  /* 去年今日 */
  M.journalYearAgo = function (data, dateStr) {
    const p = String(dateStr).split("-").map(Number);
    const y = String(p[0] - 1) + "-" + u.pad(p[1]) + "-" + u.pad(p[2]);
    return M.journalGet(data, y);
  };

  /* ── 成长轨迹（任务创建/完成 + 里程碑，合并倒序，取 60 条） ── */
  M.timelineEvents = function (data) {
    const ev = [];
    data.nodes.forEach(function (n) {
      if (n.createdAt) ev.push({ t: n.createdAt, kind: "create", node: n });
      if (n.completedAt) ev.push({ t: n.completedAt, kind: "complete", node: n });
    });
    data.milestones.forEach(function (m) {
      ev.push({ t: m.date + "T12:00:00", kind: "milestone", milestone: m });
    });
    ev.sort(function (a, b) { return b.t.localeCompare(a.t); });
    return ev.slice(0, 60);
  };

  global.LWB.Model = M;
})(window);
