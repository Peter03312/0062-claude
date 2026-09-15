# syntax=docker/dockerfile:1

# —— 依赖层（含 devDependencies，verify 阶段跑 Vitest 需要）——
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# —— 构建层：类型检查 + 生产构建（单元测试在 verify 阶段显式运行）——
FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

# —— 静态 web 层：只保留 nginx 与 dist ——
FROM nginx:1.27-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

# —— 一次性 verify 层：测试 + 生产构建 + 首页冒烟 ——
FROM deps AS verify
WORKDIR /app
COPY . .
# 对静态 web 容器做首页冒烟；命令在 compose 中注入 BASE_URL 与网络等待。
CMD ["sh", "-c", "npm test && npm run build && SMOKE_URL=\"${SMOKE_URL:-http://web:8080}\" node scripts/smoke.mjs \"${SMOKE_URL:-http://web:8080}\""]
