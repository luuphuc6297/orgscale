# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/backend/package.json apps/backend/
RUN yarn install --frozen-lockfile
COPY packages/shared-types packages/shared-types
COPY apps/backend apps/backend
RUN yarn workspace @mcm/backend build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/apps/backend/db ./apps/backend/db
COPY --from=builder /app/apps/backend/.sequelizerc ./apps/backend/
COPY --from=builder /app/packages ./packages
WORKDIR /app/apps/backend
EXPOSE 4000
CMD ["sh", "-c", "yarn migrate && yarn seed && node dist/main.js"]
