# ---- build ----
# Build context must be the `weather/` directory so ../shared/contract.ts is reachable:
#   docker build -f frontend/Dockerfile -t skycast-frontend .
FROM node:22-alpine AS build
WORKDIR /app
COPY shared ./shared
COPY frontend/package.json frontend/package-lock.json ./frontend/
WORKDIR /app/frontend
RUN npm ci --no-audit --no-fund
COPY frontend ./
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
