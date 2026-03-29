FROM python:3.12-slim AS builder
WORKDIR /app
COPY pyproject.toml .
COPY src/ ./src/
RUN pip install --no-cache-dir .

FROM python:3.12-slim
LABEL org.opencontainers.image.source="https://github.com/automationpi/mergelore"
LABEL org.opencontainers.image.description="mergelore indexer — async PR embedding service"
LABEL org.opencontainers.image.licenses="MIT"
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin/mergelore-index /usr/local/bin/mergelore-index
USER nobody
ENTRYPOINT ["mergelore-index"]
