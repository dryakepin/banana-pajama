# Local development image for the api/ serverless handlers.
#
# ARCH-1: production runs the handlers in api/ as Vercel functions. This image
# runs the SAME handler modules behind scripts/dev-api-server.js, a thin
# adapter, so local development and production cannot drift apart. There is no
# second implementation to keep in sync.
FROM node:20-alpine

WORKDIR /app

# api/ declares only `pg`; the Express stack this replaced pulled in nine
# production dependencies carrying six known advisories (see DEP-1).
COPY api/package*.json ./api/
RUN npm install --prefix api --omit=dev

COPY api/ ./api/
COPY scripts/dev-api-server.js ./scripts/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "scripts/dev-api-server.js"]
