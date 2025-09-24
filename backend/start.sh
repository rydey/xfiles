#!/bin/bash
set -euo pipefail

echo "🚀 Starting backend server..."

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Optionally run migrations/seed (disabled by default in production)
if [[ "${RUN_DB_MIGRATIONS:-false}" == "true" ]]; then
  echo "🗄️ Pushing database schema..."
  npx prisma db push
  echo "🌱 Seeding database..."
  npm run db:seed
else
  echo "⏭️  Skipping db push/seed (set RUN_DB_MIGRATIONS=true to enable)"
fi

# Build and start the server
echo "🛠️ Building backend..."
npm run build
echo "🚀 Starting Node.js server..."
npm run start
