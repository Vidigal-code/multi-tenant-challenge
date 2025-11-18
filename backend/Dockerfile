FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates procps && rm -rf /var/lib/apt/lists/* \
	&& npm ci --legacy-peer-deps || npm install

FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates procps && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-slim AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates procps && rm -rf /var/lib/apt/lists/*
EXPOSE 4000
CMD ["node", "dist/main.js"]
