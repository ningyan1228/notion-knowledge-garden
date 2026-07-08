# Tencent Cloud Proxy Deployment

Frontend stays on GitHub Pages. Only the Notion API proxy runs on the Tencent Cloud server.

## DNS

Add this DNS record before HTTPS verification:

```text
Host: knowledge-api
Type: A
Value: 43.128.149.75
```

## Server files

Upload the contents of `server/knowledge-garden-proxy/` to:

```text
~/projects/knowledge-garden-proxy
```

Required files on the server:

```text
Dockerfile
docker-compose.yml
package.json
server.js
.env
```

Use `server/knowledge-garden-proxy/.env.example` as the template for `.env`.

## Required secrets

```text
NOTION_TOKEN=secret_xxx
NOTION_DATABASE_ID=your_database_id
NOTION_DATA_SOURCE_ID=
NOTION_VERSION=2022-06-28
LETSENCRYPT_EMAIL=your-email@example.com
ALLOWED_ORIGINS=https://ningyan1228.github.io,http://127.0.0.1:4173,http://localhost:4173
```

`NOTION_DATA_SOURCE_ID` is optional. Keep secrets only on the server.

## Commands

```bash
cd ~/projects/knowledge-garden-proxy
docker compose up -d --build
docker compose down
docker compose logs -f --tail=100
```

## Tests

```bash
docker ps
docker compose ps
docker compose logs --tail=80
curl -i https://knowledge-api.gjsx.uno/health
curl -i https://knowledge-api.gjsx.uno/api/notes
```

After GitHub Pages is updated, open the frontend and confirm browser network requests go to:

```text
https://knowledge-api.gjsx.uno/api/notes
https://knowledge-api.gjsx.uno/api/notes/<id-or-slug>
```
