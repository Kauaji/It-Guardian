FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
RUN npm ci --workspace server --omit=dev

COPY server/src ./server/src
COPY server/.env.example ./server/.env.example

WORKDIR /app/server

EXPOSE 4000

CMD ["node", "src/server.js"]
