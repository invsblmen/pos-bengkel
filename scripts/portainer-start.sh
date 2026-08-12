#!/usr/bin/env sh
# Start Portainer using docker compose (Unix/macOS)
set -e

COMPOSE_FILE="docker/portainer/docker-compose.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Compose file not found: $COMPOSE_FILE"
  exit 1
fi

echo "Starting Portainer from $COMPOSE_FILE..."
docker compose -f "$COMPOSE_FILE" up -d --build
echo "Portainer should be reachable at http://localhost:9000"
