# Dùng cho VPS / Oracle Cloud / Koyeb / Fly.io
FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

# Dữ liệu SQLite nằm ở /data — gắn volume vào đây
RUN mkdir -p /data && chown -R node:node /app /data
ENV PORT=3000 DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 3000

USER node
CMD ["node", "server/index.js"]
