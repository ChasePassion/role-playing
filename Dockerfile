FROM node:20-alpine AS deps

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 3001

CMD ["pnpm", "start"]
