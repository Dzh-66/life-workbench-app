# 任务笔记工作台 · 应用外壳

纯静态应用（HTML/CSS/JS，零构建、零依赖），数据存储在私有仓库 [life-workbench-data](https://github.com/Dzh-66/life-workbench-data)，每次保存 = 一次 git 提交（提交历史即成长档案）。

## 使用方式

| 方式 | 地址 | 说明 |
|---|---|---|
| 手机 / 任意设备（推荐） | https://dzh-66.github.io/life-workbench-app/ | 公网地址，系统浏览器打开，可「添加到主屏幕」像 App 一样用；**微信内置浏览器可能拦截，请用系统浏览器** |
| 电脑本地 | 运行本仓库外层的 `start_local.bat`（或 `python -m http.server 8000` 后访问 http://localhost:8000 ） | 界面与云端完全一致；数据仍存 GitHub，需联网才能保存，断网时只读浏览 |

> 不能直接双击 index.html 打开（file:// 协议下本地存储与 Service Worker 不可靠）。

## 首次使用（每台设备一次）

1. 打开「更多 → 设置」；
2. 按页面内指引创建 GitHub fine-grained Token（仅勾选 `life-workbench-data` 仓库、Contents Read and write）；
3. 粘贴 Token → 「校验并保存」，看到 ✓ 即完成；
4. 若云端尚无数据，点顶部横幅「用示例数据初始化」。

## 数据安全

- **云端**：数据在私有 GitHub 仓库，每次保存一次提交，任何历史版本可用 `git checkout <commit> -- data.json` 找回；
- **本地**：浏览器自动缓存最近一次数据快照，断网可只读查看；
- **U 盘**：运行 `backup_to_usb.bat F:`（盘符换成实际盘符）克隆整个数据仓库到 U 盘（含全部历史）；或「更多 → 导出全量快照」生成自包含 HTML 离线保存。

## 目录结构

```
index.html            # 单页外壳（CSP、布局、脚本加载）
css/style.css         # 霓虹主题样式
js/util.js            # 工具函数（base64/日期/防抖/下载）
js/commit.js          # git 提交消息模板（历史即成长档案）
js/seed.js            # 种子数据（智商/情商/美商示例）
js/model.js           # 数据模型与纯数据操作
js/store.js           # GitHub 存储层（唯一访问 api.github.com 的模块）
js/pwa.js             # SW 注册 / 安装提示 / 微信浏览器检测
js/app.js             # 启动引导 / 保存队列 / 冲突合并 / 路由
js/views/*.js         # 焦点 / 树 / 轨迹 / 日记 / 更多 五个视图
sw.js                 # Service Worker（外壳缓存；API 不缓存）
manifest.webmanifest  # PWA 清单
icons/                # PWA 图标（tools/gen_icons.py 或 tools/icon-gen.html 生成）
tools/icon-gen.html   # 浏览器内交互式图标生成器
.github/workflows/    # GitHub Pages 自动部署
```

## 技术要点

- 存储：GitHub REST contents API（GET/PUT/DELETE），PUT 携带 sha 做乐观锁；409 冲突时自动重拉云端并重放本地修改，二次冲突弹窗选择覆盖/放弃；
- 保存：防抖 1.5s 合并连续操作为一条中文提交；单飞（同一时刻仅一个 PUT）；
- 附件：<3MB 传云端（`attachments/{nodeId}/文件名`），大文件记录 U 盘路径；
- 离线：localStorage 快照只读 + SW 外壳缓存（导航 network-first）；
- 安全：CSP 限制连接仅 `api.github.com`、零第三方脚本、Token 仅存本机 localStorage（每个 origin 独立）、Token 不写入数据仓库。

## 修改与部署

修改后 `git push` 到 main，GitHub Actions 自动部署到 Pages（约 1 分钟生效）。改 `sw.js` 时同步更新 `CACHE` 版本号。
