#!/usr/bin/env bash
set -euo pipefail
: "${AWS_PROFILE:=academy}"
: "${AWS_REGION:=us-east-1}"
for pair in '/minimarket/db-password' '/minimarket/admin-token'; do
  if aws ssm get-parameter --name "$pair" --query 'Parameter.Name' --output text >/dev/null 2>&1; then
    echo "Ya existe $pair. No se reemplaza: requiere version 1 en template."
    continue
  fi
  secret=$(openssl rand -hex 24)
  aws ssm put-parameter --name "$pair" --type SecureString --value "$secret" --no-cli-pager --query Version --output text >/dev/null
  unset secret
  echo "Parametro cifrado creado: $pair"
done
