# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server on http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint

# Docker
docker-compose up --build    # Build and run container
docker-compose up -d         # Run in background
```

There are no tests in this project.

## Architecture

This is a **single-page Next.js 14 app** (App Router) with one route: `app/page.tsx`. There are no API routes, no server components doing meaningful work, and no backend — all PDF processing runs entirely in the browser.

**PDF processing** (`app/page.tsx`): Uses `pdfjs-dist` to extract raw text from PDF pages client-side. The PDF.js worker is loaded from CDN (`cdnjs.cloudflare.com`) rather than bundled locally. Text is extracted per-page and concatenated as plain text CSV (not structured column detection). All state is local React `useState`.

**Key limitation**: The conversion is text extraction only — it does not parse table structure or column alignment from PDFs. Each page's text items are joined with spaces into a single line per page.

## Docker Notes

There is a **port mismatch**: `docker-compose.yml` maps `3210:3210` but the Dockerfile exposes `3000` and Next.js defaults to port 3000. If deploying via Docker Compose, either update the compose file to `3000:3000` or set `PORT=3210` in the environment and update `next.config.js` accordingly.

The Dockerfile also contains stray markdown content after line 45 (leftover from a paste) — the actual CMD ends at `CMD ["npm", "start"]` and everything after the closing backtick on line 46 is garbage.
