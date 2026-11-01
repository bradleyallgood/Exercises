# LEARNING NOTE: a multi-stage build. The first stages need dev dependencies and
# the whole source tree to compile the app, but only the final stage is shipped,
# so none of that ends up in the image you run.

FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Copied before the source so Docker can reuse this layer until they change.
# --ignore-scripts skips the "prepare" script: git hooks mean nothing in an image.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

# The build imports these modules but never connects, so placeholders are enough.
# ENV in this stage does not reach the final image. Real values arrive at runtime.
ENV BUILD_STANDALONE=1 \
    DATABASE_URL=postgres://placeholder:placeholder@localhost:5432/placeholder \
    BETTER_AUTH_SECRET=placeholder-secret-for-docker-build-only \
    BETTER_AUTH_URL=http://localhost:3000
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Standalone output has its own trimmed node_modules and server.js, but leaves
# static assets for you to copy in.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
