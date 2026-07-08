# 项目进度交接

## 已完成什么

- 已新建项目：`notion-knowledge-garden`，GitHub 仓库为 `ningyan1228/notion-knowledge-garden`。
- 本地项目目录已确定为：`F:\文档\个人笔记网站`，后续不要移动或改目录。
- 前端静态页面已完成，并放在 `public/` 目录，继续走 GitHub Pages 部署。
- 前端 API 地址已配置为：`https://knowledge-api.gjsx.uno`。
- GitHub Pages 工作流已准备：`.github/workflows/pages.yml`，部署内容为 `public/`。
- 服务器代理项目已创建在本地：`server/knowledge-garden-proxy/`。
- 服务器代理文件已上传到腾讯云服务器目录：`/home/ubuntu/projects/knowledge-garden-proxy`。
- 服务器代理使用 Docker Compose 部署，容器已成功 build 并启动。
- Notion 已创建集成：`Knowledge Garden`。
- Notion 数据库已建好：`个人知识花园`。
- Notion 数据库字段已配置好：
  - 标题
  - 摘要
  - 分类
  - 标签
  - 封面
  - 是否公开
  - 置顶
  - Slug
  - 状态
  - 创建时间
  - 更新时间
- Notion 数据库 ID：
  - `39768aec-7cb0-802f-8e6f-eb9c46bfb29d`
- Notion Data Source ID：
  - `39768aec-7cb0-80bf-9a1e-000b4e48b120`
- Notion 数据库里已创建两条公开测试笔记。
- 服务器 `.env` 里需要填写的核心变量已明确：
  - `NOTION_TOKEN`
  - `NOTION_DATABASE_ID`
  - `NOTION_DATA_SOURCE_ID`
  - `LETSENCRYPT_EMAIL`

## 当前卡在哪里

- 服务器 Docker 容器已经启动，但访问接口时报错：
  - `curl: (6) Could not resolve host: knowledge-api.gjsx.uno`
- 这说明当前主要问题是域名 DNS 还没有解析到服务器，或者解析还没生效。
- 需要在 `gjsx.uno` 这个域名的 DNS 解析后台添加记录：
  - 主机记录：`knowledge-api`
  - 记录类型：`A`
  - 记录值：`43.128.149.75`
  - TTL：默认
- 不是 GitHub 设置，也不是 Notion 设置，是 `gjsx.uno` 的域名解析设置。

## 下一步要做什么

- 先去 `gjsx.uno` 的域名解析后台添加：
  - `knowledge-api.gjsx.uno -> 43.128.149.75`
- 等待 1 到 10 分钟后，在服务器 VSCode 终端执行：

```bash
cd ~/projects/knowledge-garden-proxy
nslookup knowledge-api.gjsx.uno
curl -i https://knowledge-api.gjsx.uno/health
curl -i https://knowledge-api.gjsx.uno/api/notes
```

- 如果 `/health` 能返回正常结果，再测试 `/api/notes` 是否能返回 Notion 公开笔记。
- 如果 `/api/notes` 报权限错误，去 Notion 的 `个人知识花园` 数据库右上角添加连接：
  - `...` 或 `共享`
  - `连接 / Connections`
  - 添加 `Knowledge Garden`
- 如果 API 正常，再打开 GitHub Pages 页面，确认前端请求走：
  - `https://knowledge-api.gjsx.uno/api/notes`
- 最后确认页面显示 Notion 里的公开笔记，而不是示例数据。
