FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node production ./production
COPY --chown=node:node backend/public ./backend/public
USER node
EXPOSE 8788
CMD ["node","production/runtime.ts"]
