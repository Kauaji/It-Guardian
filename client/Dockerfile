FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_API_URL=http://localhost:4000/api
ARG VITE_WS_URL=ws://localhost:4000/ws

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
RUN npm ci --workspace client

COPY client/index.html client/vite.config.js ./client/
COPY client/src ./client/src
WORKDIR /app/client
RUN npm run build

FROM nginx:1.27-alpine

COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80
