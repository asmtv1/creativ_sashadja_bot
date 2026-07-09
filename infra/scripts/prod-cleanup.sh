#!/usr/bin/env sh
set -eu

KEEP_PROJECT="${KEEP_PROJECT:-tgbot}"

printf 'Docker containers before cleanup:\n'
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Label "com.docker.compose.project"}}' || true

projects="$(docker ps -a --filter label=com.docker.compose.project --format '{{.Label "com.docker.compose.project"}}' | sort -u | grep -v "^${KEEP_PROJECT}$" || true)"
for project in $projects; do
  printf '\nStopping obsolete Compose project: %s\n' "$project"
  docker compose -p "$project" down --remove-orphans || true
done

printf '\nPruning stopped containers and unused images/build cache. Named volumes are preserved.\n'
docker container prune -f || true
docker image prune -af || true
docker builder prune -af || true
docker buildx prune -af || true

printf '\nDocker containers after cleanup:\n'
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Label "com.docker.compose.project"}}' || true
