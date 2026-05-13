FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY pyproject.toml README.md ./
COPY app ./app
COPY docs ./docs
COPY fixtures ./fixtures
COPY scripts ./scripts

RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["python", "-m", "app.main"]

