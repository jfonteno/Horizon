FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV HORIZON_STANDALONE=1
RUN npm run build:self-hosted

RUN mkdir -p /data/rooms && chown -R node:node /data

USER node

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    HORIZON_DATA_DIR=/data/rooms \
    HORIZON_CONTENT_DIR=/data/content

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["npm", "run", "start:self-hosted"]
