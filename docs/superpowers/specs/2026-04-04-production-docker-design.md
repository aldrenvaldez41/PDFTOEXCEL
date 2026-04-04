# Production-Ready Docker Deployment — Design Spec

**Date:** 2026-04-04
**Status:** Approved

---

## Goal

Make the PDF-to-CSV Next.js app self-hostable on a VPS behind an existing Caddy reverse proxy, with a lean Docker image, no external CDN dependencies, and a simple one-command deploy workflow.

---

## Architecture

```
Browser → Caddy (HTTPS :443, IP allowlist) → localhost:3210 → Docker (3210:3000) → Next.js standalone
```

- **Caddy** handles TLS, IP-based access control, and reverse proxying. No changes to the Caddy process itself — only a new site block added to the Caddyfile.
- **Docker** runs a single container. Image is built directly on the VPS from source (`git pull` + `docker compose up --build`). No DockerHub or registry required.
- **Next.js** runs as a standalone output build — copies only the files needed to run, cutting the image from ~500MB to ~150MB.
- **PDF.js worker** is copied from `node_modules/pdfjs-dist/build/pdf.worker.min.js` into `public/` via a `postinstall` npm script, then served as a static asset at `/pdf.worker.min.js`. Removes the CDN dependency on `cdnjs.cloudflare.com`.

---

## File Changes

### `next.config.js`
Add `output: 'standalone'` to enable the standalone build mode.

```js
const nextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    swcMinify: true,
    compress: true,
    poweredByHeader: false,
    productionBrowserSourceMaps: false,
    experimental: {
        optimizeFonts: true,
    },
}
```

### `package.json`
Add a `postinstall` script to copy the PDF.js worker into `public/`:

```json
"scripts": {
    "postinstall": "node -e \"require('fs').copyFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.js', 'public/pdf.worker.min.js')\"",
    ...
}
```

### `app/page.tsx`
Change the `workerSrc` line from the CDN URL to a local path:

```ts
// Before
PDFJS.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS.version}/pdf.worker.min.js`;

// After
PDFJS.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
```

### `Dockerfile`
Rewrite to fix broken content (markdown garbage after `CMD`) and use the standalone output copy pattern:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
```

### `docker-compose.yml`
Fix port mapping (3210:3000), fix healthcheck URL, add env var support:

```yaml
version: '3.8'
services:
  pdf-to-csv:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: pdf-to-csv
    ports:
      - "3210:3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HOSTNAME=0.0.0.0
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
networks: {}
```

> Note: `HOSTNAME=0.0.0.0` is required for Next.js standalone to bind on all interfaces inside the container.

### `.dockerignore` (new)
```
node_modules
.next
.git
.gitignore
*.md
.env
.env.local
.DS_Store
docs
```

### `.env.example` (new)
```
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
```

### `deploy.sh` (new)
One-command update script to run on the VPS:

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"
git pull
docker compose up --build -d
docker image prune -f
echo "Deployed successfully"
```

Make executable: `chmod +x deploy.sh`

---

## Caddyfile Snippet

Add to the existing Caddyfile on the VPS (not a project file — VPS config only):

```caddyfile
pdf.yourdomain.com {
    @allowed remote_ip YOUR.IP.HERE
    handle @allowed {
        reverse_proxy localhost:3210
    }
    handle {
        respond "Access denied" 403
    }
}
```

Then reload Caddy: `caddy reload` or `systemctl reload caddy`.

---

## VPS First-Time Setup

```bash
git clone <your-repo-url> ~/pdf-to-csv
cd ~/pdf-to-csv
cp .env.example .env
docker compose up --build -d
```

Subsequent deploys:
```bash
./deploy.sh
```

---

## Out of Scope

- No DockerHub / container registry — image built locally on VPS
- No CI/CD pipeline
- No Watchtower
- No changes to app functionality
