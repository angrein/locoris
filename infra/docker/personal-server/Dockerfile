FROM node:22-alpine

WORKDIR /app

COPY apps/personal-server /app/apps/personal-server
COPY packages/sync-core /app/packages/sync-core

ENV PORT=8787
ENV SYNC_DATA_DIR=/data

EXPOSE 8787

CMD ["node", "/app/apps/personal-server/server.mjs"]
