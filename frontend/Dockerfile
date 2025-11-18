FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_DEFAULT_COMPANY_LOGO
ENV NEXT_PUBLIC_DEFAULT_COMPANY_LOGO=$NEXT_PUBLIC_DEFAULT_COMPANY_LOGO
RUN pnpm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@latest --activate
ARG NEXT_PUBLIC_DEFAULT_COMPANY_LOGO
ENV NEXT_PUBLIC_DEFAULT_COMPANY_LOGO=$NEXT_PUBLIC_DEFAULT_COMPANY_LOGO
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
RUN pnpm install --prod --frozen-lockfile
EXPOSE 3000
CMD ["pnpm", "run", "start"]
