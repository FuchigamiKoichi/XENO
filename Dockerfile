# Dockerfile
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ビルドが必要な場合（例: TypeScriptやフロントend）:
# COPY . .
# RUN npm run build
# ここではサーバのみを想定
COPY . .

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]