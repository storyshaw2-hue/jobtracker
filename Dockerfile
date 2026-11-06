FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
COPY schemas ./schemas
COPY docs ./docs
COPY fixtures ./fixtures
COPY public ./public
ENV HOST=0.0.0.0 PORT=5001 APP_MODE=standalone
VOLUME ["/app/.data"]
EXPOSE 5001
CMD ["node", "src/server.mjs"]
