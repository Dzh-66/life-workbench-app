/* 任务笔记工作台 - 提交消息模板（git 历史即成长档案） */
(function (global) {
  "use strict";
  const u = global.LWB.util;
  const t = function (s) { return u.truncate(s, 20); };
  const C = {
    /* op: {type, ...} → 中文提交消息 */
    msg: function (op) {
      if (!op) return "📝 更新数据";
      switch (op.type) {
        case "init": return "🌱 初始化：任务笔记工作台数据";
        case "create": return "🌱 新建：" + t(op.title);
        case "update": return "✏️ 更新：" + t(op.title);
        case "start": return "⏳ 进行中：" + t(op.title);
        case "done": return "✅ 完成：" + t(op.title);
        case "reopen": return "↩️ 重启：" + t(op.title);
        case "note": return "📝 笔记：" + t(op.title);
        case "delete": return "🗑️ 删除：" + t(op.title);
        case "attach": return "📎 附件：" + t(op.node) + " ← " + t(op.file);
        case "attach-del": return "🧹 清理附件：" + t(op.node) + " ← " + t(op.file);
        case "usb-path": return "💾 U盘路径：" + t(op.node) + " ← " + t(op.file);
        case "focus": return "🎯 今日焦点：" + op.n + " 个任务";
        case "checkin": return "☑️ 打卡：" + t(op.title);
        case "uncheckin": return "↩️ 取消打卡：" + t(op.title);
        case "habit-add": return "🔁 新习惯：" + t(op.title);
        case "habit-del": return "🚫 移除习惯：" + t(op.title);
        case "milestone-add": return "🏆 里程碑：" + t(op.title);
        case "milestone-update": return "🏆 更新里程碑：" + t(op.title);
        case "milestone-del": return "🗑️ 删除里程碑：" + t(op.title);
        case "journal": return "📔 日记：" + op.date;
        case "import": return "📥 导入备份：" + op.n + " 节点";
        case "prefs": return "⚙️ 更新设置";
        default: return "📝 更新数据";
      }
    }
  };
  global.LWB.Commit = C;
})(window);
