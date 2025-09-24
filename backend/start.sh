#!/bin/bash

echo "🚀 Starting backend server..."

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Push database schema
echo "🗄️ Pushing database schema..."
npx prisma db push

# Seed database if needed
echo "🌱 Seeding database..."
npm run db:seed

# Start the server
echo "🚀 Starting Node.js server..."
npm start
