# =============================================================================
# Frontend Dockerfile — multi-stage build
#
# Stage 1 (build): compiles React/TS to static assets via Vite
# Stage 2 (runtime): serves static assets with nginx:alpine
# =============================================================================

# --- Build stage ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src
RUN npm run build

# --- Runtime stage ---
FROM nginx:alpine AS runtime

# Remove default nginx config and replace with SPA config
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
