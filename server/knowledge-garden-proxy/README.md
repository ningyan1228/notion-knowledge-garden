# knowledge-garden-proxy

Node.js proxy for the Notion Knowledge Garden GitHub Pages frontend.

Production target:

```text
~/projects/knowledge-garden-proxy
https://knowledge-api.gjsx.uno
```

## Server setup

Copy this folder to the server:

```bash
mkdir -p ~/projects/knowledge-garden-proxy
cd ~/projects/knowledge-garden-proxy
```

Create `.env` from `.env.example` and fill real values:

```bash
cp .env.example .env
nano .env
```

Start:

```bash
docker compose up -d --build
```

Check:

```bash
docker ps
docker compose ps
docker compose logs --tail=80
curl -i https://knowledge-api.gjsx.uno/health
curl -i https://knowledge-api.gjsx.uno/api/notes
```

Stop:

```bash
docker compose down
```
