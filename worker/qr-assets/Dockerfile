# QR asset render worker — separate deploy target (NOT Vercel).
# playwright-core lives here only, keeping Chromium out of the Next.js bundle.
FROM mcr.microsoft.com/playwright:v1.51.1-jammy

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --prod

COPY . .

ENV NODE_ENV=production
# The worker self-polls Postgres on an interval and also exposes POST /drain so
# the Vercel cron (/api/cron/qr-assets) can nudge it between intervals.
EXPOSE 8080
CMD ["node", "index.mjs"]
