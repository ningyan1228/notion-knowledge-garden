# Notion Knowledge Garden

个人笔记系统 / 知识花园。

目标架构：

```text
GitHub Pages static frontend
  -> https://knowledge-api.gjsx.uno
  -> Tencent Cloud Docker proxy
  -> Notion API
```

Notion Token 只放服务器 `.env`，不会写进前端。

## GitHub 仓库名

建议创建：

```text
ningyan1228/notion-knowledge-garden
```

## 前端功能

- 首页知识库概览：总笔记数、分类数、标签数、最近更新
- 卡片式笔记列表
- 搜索标题、摘要、分类、标签
- 按分类和标签筛选
- 按最近更新、创建时间、标题排序
- 笔记详情抽屉
- API 不可用时显示示例数据

## Notion 数据库字段

建议新建数据库「个人知识花园」：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| Title / 标题 | Title | 笔记标题 |
| Summary / 摘要 | Text | 卡片和详情摘要 |
| Category / 分类 | Select | 主分类 |
| Tags / 标签 | Multi-select | 多个标签 |
| Cover / 封面 | Files 或 URL | 可选封面；也支持 Notion 页面封面 |
| Published / 是否公开 | Checkbox | 只有勾选才展示 |
| Pinned / 置顶 | Checkbox | 置顶排序 |
| Slug | Text | 可选，作为详情地址 key |
| Status / 状态 | Status 或 Select | 可选 |
| Created / 创建时间 | Date | 可选 |
| Updated / 更新时间 | Date | 可选 |

## GitHub Pages 上传文件

上传这些到仓库：

```text
.gitignore
.github/workflows/pages.yml
README.md
SERVER_DEPLOY.md
package.json
public/index.html
public/assets/app.js
public/assets/config.js
public/assets/styles.css
server/knowledge-garden-proxy/.env.example
server/knowledge-garden-proxy/Dockerfile
server/knowledge-garden-proxy/README.md
server/knowledge-garden-proxy/docker-compose.yml
server/knowledge-garden-proxy/package.json
server/knowledge-garden-proxy/server.js
```

不要上传：

```text
.env
node_modules/
.netlify/
work/
outputs/
.codex/
.agents/
server/knowledge-garden-proxy/.env
```

## 服务器部署

把 `server/knowledge-garden-proxy/` 里的文件放到服务器：

```text
~/projects/knowledge-garden-proxy
```

然后按 `SERVER_DEPLOY.md` 操作。
