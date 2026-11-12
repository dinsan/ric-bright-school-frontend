# syntax=docker/dockerfile:1

# Production image for the Lumina web app (Next.js standalone output).
#
#   docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 -t lumina-web .
#   docker run --rm -p 3000:3000 -e API_URL=http://host.docker.internal:8000 lumina-web
#
# NEXT_PUBLIC_API_URL (build argument): the API address the *browser* uses. It is baked
#   into the JavaScript bundle, so changing it means rebuilding the image.
# API_URL (runtime variable): the API address the *server* uses for server-side rendering.
#   Inside a container "localhost" is the container itself, so set this to an address the
#   container can reach. Falls back to NEXT_PUBLIC_API_URL when unset.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S lumina && adduser -S lumina -G lumina
COPY --from=build --chown=lumina:lumina /app/public ./public
COPY --from=build --chown=lumina:lumina /app/.next/standalone ./
COPY --from=build --chown=lumina:lumina /app/.next/static ./.next/static
USER lumina
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:3000/ || exit 1
CMD ["node", "server.js"]
