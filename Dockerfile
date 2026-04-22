# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Misma origen: el front llama a /api en el mismo host que sirve Express
ENV VITE_USE_API=true
ENV VITE_API_BASE=

RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY --from=builder /app/dist ./dist

RUN chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "server/index.mjs"]
