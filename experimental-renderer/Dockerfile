FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core fonts-noto-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY render.py server.py ./
ENV PYTHONUNBUFFERED=1
USER 65532:65532
CMD ["python", "server.py"]
