FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
RUN npm ci --workspace server --omit=dev

COPY server/src ./server/src
COPY server/.env.example ./server/.env.example
COPY shared ./shared

WORKDIR /app/server

# Nao roda como root; /health/live nao depende do banco (nao reinicia o contêiner por queda do banco).
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
