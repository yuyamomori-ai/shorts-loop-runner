FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-noto-cjk fontconfig ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY runner ./runner
COPY lib ./lib
COPY local-dist ./local-dist
ENV HOST=0.0.0.0 PORT=8787 DATA_DIR=/app/data
EXPOSE 8787
CMD ["node", "runner/server.mjs"]
