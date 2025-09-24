# 🚂 Railway Deployment Guide

## ✅ **SETUP COMPLETE**

Your backend is now ready for Railway deployment! Here's what I've prepared:

### **Files Created:**
- ✅ `backend/railway.json` - Railway configuration
- ✅ `backend/Procfile` - Process definition
- ✅ `backend/env.production` - Environment variables template

---

## 🚀 **RAILWAY DEPLOYMENT STEPS**

### **Step 1: Go to Railway**
1. Visit [railway.app](https://railway.app)
2. **Sign up/Login** with GitHub
3. **Click "New Project"**

### **Step 2: Deploy from GitHub**
1. **Select "Deploy from GitHub repo"**
2. **Choose your repository:** `rydey/xfiles`
3. **Select "backend" folder** as the root directory
4. **Click "Deploy"**

### **Step 3: Add PostgreSQL Database**
1. **In your project dashboard, click "+ New"**
2. **Select "Database" → "PostgreSQL"**
3. **Railway will automatically:**
   - Create a PostgreSQL database
   - Set `DATABASE_URL` environment variable
   - Connect it to your backend

### **Step 4: Set Environment Variables**
1. **Go to your backend service**
2. **Click "Variables" tab**
3. **Add these variables:**

```env
# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-change-this
JWT_EXPIRES_IN=7d

# Server Configuration
NODE_ENV=production
PORT=3001

# CORS (Update with your Vercel frontend URL)
FRONTEND_URL=https://your-app.vercel.app
```

### **Step 5: Deploy Database Schema**
1. **Go to your backend service**
2. **Click "Deployments" tab**
3. **Click on the latest deployment**
4. **Click "View Logs"**
5. **Run these commands in the Railway console:**

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed initial data
npm run db:seed
```

---

## 🔧 **AUTOMATIC DEPLOYMENT**

Railway will automatically:
- ✅ Detect Node.js project
- ✅ Install dependencies (`npm install`)
- ✅ Build the project (`npm run build`)
- ✅ Start the server (`npm start`)
- ✅ Provide a public URL

---

## 🌐 **GET YOUR BACKEND URL**

After deployment:
1. **Go to your backend service**
2. **Click "Settings" tab**
3. **Copy the "Public URL"**
4. **Use this URL in your Vercel environment variables**

**Example:** `https://your-backend-production.up.railway.app`

---

## 🔄 **UPDATE VERCEL WITH BACKEND URL**

1. **Go to your Vercel project**
2. **Settings → Environment Variables**
3. **Update `VITE_API_URL`:**
   ```
   VITE_API_URL=https://your-backend-production.up.railway.app/api
   ```
4. **Redeploy your frontend**

---

## 🎯 **RAILWAY FEATURES**

### **Free Tier Includes:**
- ✅ **$5 credit/month** (usually enough for small apps)
- ✅ **PostgreSQL database**
- ✅ **Automatic deployments**
- ✅ **Custom domains**
- ✅ **Environment variables**
- ✅ **Logs and monitoring**

### **Automatic Scaling:**
- ✅ **Auto-deploy** on Git push
- ✅ **Health checks** on `/health` endpoint
- ✅ **Restart** on failure
- ✅ **Zero-downtime** deployments

---

## 🆘 **TROUBLESHOOTING**

### **Common Issues:**

1. **Build Fails:**
   - Check that all dependencies are in `package.json`
   - Ensure TypeScript compiles successfully

2. **Database Connection:**
   - Verify `DATABASE_URL` is set correctly
   - Run `npx prisma db push` to sync schema

3. **CORS Errors:**
   - Update `FRONTEND_URL` with your Vercel domain
   - Restart the backend service

4. **Authentication Issues:**
   - Ensure `JWT_SECRET` is set
   - Check that frontend and backend use the same secret

### **Railway Console Commands:**
```bash
# Check if database is connected
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed database
npm run db:seed

# Check logs
railway logs
```

---

## 🎉 **YOU'RE READY FOR RAILWAY!**

Your backend is optimized for Railway and ready to deploy. The configuration is complete and all necessary files are in place.

**Estimated deployment time:** 5-10 minutes
**Cost:** Free (Railway $5 credit/month)

---

## 📋 **DEPLOYMENT CHECKLIST**

- [ ] Code pushed to GitHub ✅
- [ ] Railway project created
- [ ] PostgreSQL database added
- [ ] Environment variables set
- [ ] Database schema deployed
- [ ] Backend URL obtained
- [ ] Vercel updated with backend URL
- [ ] Test full application

**Your backend is Railway-ready!** 🚂
