#!/bin/bash

echo "🚀 Preparing for deployment..."

# 1. Build frontend
echo "📦 Building frontend..."
cd frontend
npm run build
cd ..

# 2. Create production environment template
echo "⚙️ Creating production environment template..."
cat > backend/.env.production << EOF
# Production Environment Variables
DATABASE_URL="postgresql://user:password@host:port/database"
JWT_SECRET="your-super-secure-jwt-secret-key-change-this"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV="production"
FRONTEND_URL="https://your-frontend-domain.vercel.app"
EOF

# 3. Create deployment README
echo "📝 Creating deployment instructions..."
cat > DEPLOY_INSTRUCTIONS.md << EOF
# 🚀 Deployment Instructions

## 1. GitHub Setup
\`\`\`bash
git init
git add .
git commit -m "Ready for deployment"
git remote add origin https://github.com/yourusername/yourrepo.git
git push -u origin main
\`\`\`

## 2. Vercel (Frontend)
1. Go to https://vercel.com
2. Connect GitHub account
3. Import repository
4. Set build command: \`npm run build\`
5. Set output directory: \`dist\`
6. Deploy!

## 3. Railway (Backend + Database)
1. Go to https://railway.app
2. Connect GitHub account
3. Create new project from repo
4. Add PostgreSQL database
5. Set environment variables from .env.production
6. Deploy!

## 4. Update Frontend API URL
Update your frontend to use Railway backend URL in API calls.
EOF

echo "✅ Deployment preparation complete!"
echo "📋 Check DEPLOY_INSTRUCTIONS.md for next steps"
