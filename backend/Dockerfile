FROM node:20-alpine AS compilador
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache git docker-cli
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=compilador /app/dist ./dist
COPY migraciones ./migraciones
RUN chown -R node:node /app
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
