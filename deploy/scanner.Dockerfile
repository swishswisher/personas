FROM node:24-bookworm-slim
WORKDIR /app
COPY deploy/scanner.mjs ./scanner.mjs
USER node
EXPOSE 8080
CMD ["node", "scanner.mjs"]
