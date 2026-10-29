/* 任务笔记工作台 - 种子数据（来自原元宝工作台的示例：智商/情商/美商） */
(function (global) {
  "use strict";
  const raw = [
    { id: "n-iq", parentId: null, title: "智商", type: "domain", status: "todo", note: "智力与学业成长领域。", createdAt: "2026-10-29T08:50:00.000Z", completedAt: null, collapsed: true, attachments: [], workspacePath: "" },
    { id: "n-math", parentId: "n-iq", title: "数学", type: "domain", status: "todo", note: "数学整体领域，含竞赛与常规学习。", createdAt: "2026-10-29T09:00:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-math-1", parentId: "n-math", title: "数学竞赛", type: "task", status: "inprogress", note: "目标：下学期校内竞赛拿奖。", createdAt: "2026-10-29T09:05:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-math-1-1", parentId: "n-math-1", title: "数论专题", type: "task", status: "inprogress", note: "重点：同余、费马小定理、欧拉定理。", createdAt: "2026-10-29T09:10:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-math-1-2", parentId: "n-math-1", title: "组合数学专题", type: "task", status: "todo", note: "先刷基础计数题，再做抽屉原理。", createdAt: "2026-10-29T09:12:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-math-2", parentId: "n-math", title: "日常作业", type: "task", status: "todo", note: "本周作业已全部完成。", createdAt: "2026-10-27T09:00:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-eng", parentId: "n-iq", title: "英语（六级）", type: "domain", status: "inprogress", note: "目标：12月六级 550+。", createdAt: "2026-10-29T09:20:00.000Z", completedAt: null, collapsed: true, attachments: [], workspacePath: "" },
    { id: "n-eng-1", parentId: "n-eng", title: "听力", type: "task", status: "inprogress", note: "每天精听 30 分钟真题。", createdAt: "2026-10-29T09:22:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-eng-2", parentId: "n-eng", title: "词汇", type: "task", status: "todo", note: "高频词过完一遍后开始做阅读。", createdAt: "2026-10-29T09:24:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-fit", parentId: "n-iq", title: "健身", type: "domain", status: "inprogress", note: "每周 4 练，力量为主。", createdAt: "2026-10-29T09:30:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-fit-1", parentId: "n-fit", title: "力量训练计划", type: "task", status: "inprogress", note: "推拉腿分化，记录重量递增。", createdAt: "2026-10-29T09:32:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-other", parentId: "n-iq", title: "其他", type: "domain", status: "todo", note: "杂项与临时想法。", createdAt: "2026-10-29T09:40:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-eq", parentId: null, title: "情商", type: "domain", status: "todo", note: "情绪与人际成长领域。", createdAt: "2026-10-29T08:51:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-eq-1", parentId: "n-eq", title: "沟通表达", type: "task", status: "todo", note: "", createdAt: "2026-10-29T08:52:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-eq-2", parentId: "n-eq", title: "情绪管理", type: "task", status: "todo", note: "", createdAt: "2026-10-29T08:53:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-eq-3", parentId: "n-eq", title: "人际关系", type: "task", status: "todo", note: "", createdAt: "2026-10-29T08:54:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-bq", parentId: null, title: "美商", type: "domain", status: "todo", note: "审美与表达成长领域。", createdAt: "2026-10-29T08:55:00.000Z", completedAt: null, collapsed: true, attachments: [], workspacePath: "" },
    { id: "n-bq-1", parentId: "n-bq", title: "穿搭审美", type: "task", status: "todo", note: "", createdAt: "2026-10-29T08:56:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-bq-2", parentId: "n-bq", title: "摄影构图", type: "task", status: "todo", note: "", createdAt: "2026-10-29T08:57:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" },
    { id: "n-bq-3", parentId: "n-bq", title: "设计基础", type: "task", status: "todo", note: "", createdAt: "2026-10-29T08:58:00.000Z", completedAt: null, collapsed: false, attachments: [], workspacePath: "" }
  ];
  const nodes = raw.map(function (n) { n.focusDates = []; return n; });
  const seed = {
    schemaVersion: 1,
    nodes: nodes,
    milestones: [],
    habits: [],
    journals: {},
    preferences: { owner: "Dzh-66", repo: "life-workbench-data", defaultView: "focus", lastSyncAt: null }
  };
  global.LWB = global.LWB || {};
  global.LWB.seed = seed;
})(window);
