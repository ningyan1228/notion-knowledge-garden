# 项目进度交接

## 已完成什么

- 项目名：`notion-knowledge-garden`，本地目录固定为 `F:\文档\个人笔记网站`。
- GitHub 仓库：`ningyan1228/notion-knowledge-garden`。
- 前端继续部署在 GitHub Pages，当前访问域名：`https://notes.101921.xyz`。
- API 代理部署在腾讯云服务器，接口域名：`https://knowledge-api.gjsx.uno`。
- 服务器代理目录：`/home/ubuntu/projects/knowledge-garden-proxy`。
- 网站已经接入 Notion 数据库，可以读取公开笔记、详情内容、分类、标签、封面、学习时长。
- 已实现网站内写笔记、编辑笔记、分类筛选、标签筛选、搜索、排序、分页加载。
- 已实现日记 / 笔记 / 灵感 / 复盘类型区分，日记默认偏私密展示。
- 已实现知识星图、热力成长地图、今日记录、今日待整理、拾光日记等模块。
- 已改成账号登录模式：
  - `zhiwu`
  - `juanjuan`
- 多用户规则已设计并写入前后端逻辑：
  - 公开且不是日记的内容，两个账号都可以看到。
  - 私密内容只能作者自己看到。
  - 日记只能作者自己看到。
  - 只能编辑自己的笔记。
- 本次已开始整理 UI：
  - 首页工作台从杂乱卡片流改成更清晰的分区布局。
  - 修复知识星图全屏时画布尺寸不正确的问题。

## 当前卡在哪里

- Notion 数据库还需要手动确认这 3 个字段已经存在：
  - `作者`：富文本
  - `用户ID`：富文本
  - `可见性`：选择，选项为 `公开`、`私密`
- Notion 插件之前尝试自动添加字段失败，所以这 3 个字段需要在 Notion 数据库里手动加。
- 图片粘贴上传仍需要继续打磨：目标是不把图片存服务器，而是通过 Notion 文件能力或外链方式进入 Notion。
- 当前 UI 已做第一轮收敛，但还需要上传到 GitHub Pages 后在真实页面看效果。

## 下一步要做什么

- 上传这些前端文件到 GitHub 仓库：
  - `public/index.html`
  - `public/assets/app.js`
  - `public/assets/styles.css`
  - `progress.md`
- 如果服务器端有新改动，再上传：
  - `server/knowledge-garden-proxy/server.js`
- 上传后打开 `https://notes.101921.xyz`，按 `Ctrl + F5` 强制刷新。
- 检查首页是否更清爽，重点看：
  - 今日拾光区域是否不再过高。
  - 今日待整理是否是主区域。
  - 主题 / 标签 / 最近 / 随机是否变成次级信息。
  - 知识星图全屏后节点是否正常出现。
- 如果 Notion 字段还没补齐，先去 Notion 数据库增加 `作者`、`用户ID`、`可见性`。
