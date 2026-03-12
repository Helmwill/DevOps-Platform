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

# nginx:alpine ships with a non-root `nginx` user; use it to satisfy security scanners.
# The server block in nginx.conf listens on 8080 (unprivileged port).
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
