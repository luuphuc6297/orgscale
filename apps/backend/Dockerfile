FROM node:20-alpine AS build
WORKDIR /app

COPY package.json yarn.lock* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN yarn install

COPY apps/backend ./apps/backend
COPY packages/shared-types ./packages/shared-types

WORKDIR /app/apps/backend
RUN yarn build

FROM node:20-alpine AS runtime
WORKDIR /app

COPY --from=build /app/package.json /app/yarn.lock* ./
COPY --from=build /app/apps/backend/package.json ./apps/backend/
COPY --from=build /app/packages/shared-types ./packages/shared-types
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/db ./apps/backend/db
COPY --from=build /app/apps/backend/.sequelizerc ./apps/backend/

WORKDIR /app/apps/backend
EXPOSE 4000
CMD ["node", "dist/main.js"]
