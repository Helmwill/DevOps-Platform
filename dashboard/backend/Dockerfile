# =============================================================================
# Backend Dockerfile — multi-stage build
#
# Stage 1 (build): compiles TypeScript to JavaScript
# Stage 2 (runtime): runs compiled JS on node:20-alpine as non-root user
# =============================================================================

# --- Build stage ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine AS runtime

WORKDIR /app

# Upgrade npm to get patched versions of its bundled deps (tar, minimatch, etc.)
RUN npm install -g npm@latest

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output from build stage
COPY --from=build /app/dist ./dist

# Run as non-root user
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
