FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps || npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_DEFAULT_COMPANY_LOGO
ENV NEXT_PUBLIC_DEFAULT_COMPANY_LOGO=$NEXT_PUBLIC_DEFAULT_COMPANY_LOGO
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ARG NEXT_PUBLIC_DEFAULT_COMPANY_LOGO
ENV NEXT_PUBLIC_DEFAULT_COMPANY_LOGO=$NEXT_PUBLIC_DEFAULT_COMPANY_LOGO
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
RUN npm install --omit=dev --legacy-peer-deps || npm install --omit=dev
EXPOSE 3000
CMD ["npm", "run", "start"]
