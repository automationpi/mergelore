FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
LABEL org.opencontainers.image.source="https://github.com/automationpi/mergelore"
LABEL org.opencontainers.image.description="mergelore — institutional memory for AI-generated PRs"
LABEL org.opencontainers.image.licenses="MIT"
WORKDIR /app
COPY --from=builder /app/dist/index.js ./dist/index.js
COPY action.yml ./
ENTRYPOINT ["node", "/app/dist/index.js"]
