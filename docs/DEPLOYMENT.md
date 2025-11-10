# Deploying Echos to Production (Railway + Resend)

This guide walks you through deploying Echos as a SaaS using Railway (hosting) and Resend (email).

---

## 🎯 What You'll Deploy

- **Backend API** (NestJS) → Railway Service
- **Web UI** (Nuxt 3) → Railway Service  
- **PostgreSQL** → Railway Database
- **Email** → Resend

**Total Cost**: ~$5-10/month to start (Railway free tier + Resend free tier)

---

## 📋 Prerequisites

1. **Railway Account** - https://railway.app (free tier available)
2. **Resend Account** - https://resend.com (3,000 emails/month free)
3. **Domain** (optional) - For custom email sender and branding

---

## 🚀 Step-by-Step Deployment

### 1. Set Up Resend

1. Go to https://resend.com and sign up
2. Add and verify your domain (or use `onboarding@resend.dev` for testing)
3. Create an API key → Copy it (starts with `re_`)

### 2. Deploy to Railway

#### Option A: One-Click Deploy (Easiest)

1. Click the button below:
   
   [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

2. Connect your GitHub repository
3. Railway will auto-detect the services:
   - `echos-backend` (server/)
   - `echos-frontend` (web/)
   - PostgreSQL database

#### Option B: Manual Deploy

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Create New Project**:
   ```bash
   railway init
   railway link
   ```

3. **Add PostgreSQL**:
   ```bash
   railway add --database postgres
   ```

4. **Deploy Services**:
   ```bash
   # Deploy backend
   cd server
   railway up
   
   # Deploy frontend
   cd ../web
   railway up
   ```

### 3. Configure Environment Variables

In Railway dashboard, set these for **Backend Service**:

```bash
# Database (auto-configured by Railway)
DATABASE_URL=${DATABASE_URL}

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Resend
RESEND_API_KEY=re_your_resend_api_key_here
FROM_EMAIL=auth@yourdomain.com

# Base URL (Railway provides this)
BASE_URL=https://your-app.railway.app

# Node Environment
NODE_ENV=production
```

For **Frontend Service**:

```bash
# API URL (Railway backend URL)
NUXT_PUBLIC_API_URL=https://your-backend.railway.app

NODE_ENV=production
```

### 4. Initialize Database

Run the database schema on Railway:

```bash
# Get database URL from Railway
railway variables

# Run schema
psql $DATABASE_URL < server/src/database/schema.sql
```

Or use Railway's built-in database console.

### 5. Test Your Deployment

1. Visit your Railway frontend URL
2. Click "Sign Up"
3. Enter your email → Check inbox for magic link
4. Create an API key
5. Test the runtime:

```bash
npx @echoshq/runtime
# Or in your code
import { EchosRuntime } from '@echoshq/runtime';

const runtime = new EchosRuntime({
  apiKey: 'ek_live_your_production_key',
  apiUrl: 'https://your-backend.railway.app'
});

await runtime.run('Test task');
```

---

## 🔧 Railway Configuration

### Backend Service (`server/`)

**Build Command**:
```bash
npm install && npm run build
```

**Start Command**:
```bash
node dist/main.js
```

**Health Check**:
- Path: `/health`
- Port: 4000 (auto-detected)

### Frontend Service (`web/`)

**Build Command**:
```bash
npm install && npm run build
```

**Start Command**:
```bash
node .output/server/index.mjs
```

**Port**: 3000 (auto-detected)

---

## 📧 Email Configuration

### Using Your Own Domain (Recommended)

1. **Add Domain in Resend**:
   - Go to Domains → Add Domain
   - Add DNS records (SPF, DKIM, DMARC)
   - Verify domain

2. **Update Environment Variables**:
   ```bash
   FROM_EMAIL=auth@yourdomain.com
   ```

3. **Email Template Customization**:
   Edit `server/src/auth/auth.service.ts` → `getMagicLinkEmailTemplate()`

### Using Resend Test Domain (Quick Start)

For testing, use:
```bash
FROM_EMAIL=onboarding@resend.dev
```

Note: Test domain has limitations (deliverability, branding)

---

## 💰 Cost Breakdown

### Railway
- **Free Tier**: $5 credit/month
  - ~500 hours of service time
  - 512 MB RAM per service
  - 1 GB disk
  
- **Pro Plan**: $20/month
  - Unlimited services
  - Custom domains
  - Better performance

### Resend
- **Free Tier**: 3,000 emails/month
- **Paid**: $20/month for 50,000 emails

**Estimated Monthly Cost**: 
- Development: $0 (free tiers)
- Small SaaS: $5-10/month
- Growing SaaS: $20-40/month

---

## 🔐 Security Checklist

Before going live:

- [ ] Set strong `JWT_SECRET` (use: `openssl rand -base64 32`)
- [ ] Enable Railway's built-in SSL
- [ ] Set up custom domain with HTTPS
- [ ] Configure CORS properly
- [ ] Enable rate limiting (in NestJS guards)
- [ ] Set up monitoring/alerts
- [ ] Back up database regularly (Railway auto-backups)
- [ ] Review API key permissions
- [ ] Add environment-specific configs
- [ ] Set up error tracking (Sentry, LogRocket)

---

## 📊 Monitoring

### Railway Dashboard
- View logs in real-time
- Monitor resource usage
- Set up deployment notifications

### Application Health
```bash
# Backend health check
curl https://your-backend.railway.app/health

# Response:
# { "status": "ok", "database": "connected" }
```

### Logs
```bash
# View logs via CLI
railway logs

# Or in Railway dashboard → Service → Logs
```

---

## 🐛 Troubleshooting

### "Failed to send magic link email"

Check:
1. `RESEND_API_KEY` is set correctly
2. `FROM_EMAIL` domain is verified
3. Email isn't in spam folder
4. Check Resend dashboard logs

### "Database connection failed"

Check:
1. `DATABASE_URL` is set
2. Database is running in Railway
3. Schema is initialized
4. Firewall rules (Railway handles this)

### "API key validation failed"

Check:
1. `BASE_URL` matches frontend URL
2. `NUXT_PUBLIC_API_URL` points to backend
3. CORS is configured
4. API key hasn't been revoked

---

## 🚀 Going Further

### Custom Domain

1. **Add Domain in Railway**:
   - Railway Settings → Networking → Custom Domain
   - Add your domain: `app.yourdomain.com`
   - Point DNS to Railway

2. **Update Environment Variables**:
   ```bash
   BASE_URL=https://app.yourdomain.com
   ```

### Multiple Environments

Create separate Railway projects:
- `echos-dev` → Development
- `echos-staging` → Staging  
- `echos-prod` → Production

### CI/CD

Railway auto-deploys on git push:
```bash
git push origin main
# Railway automatically builds and deploys
```

### Scaling

When you grow:
- Upgrade Railway plan
- Add multiple replicas
- Use Railway's built-in load balancing
- Add caching (Redis)
- Consider CDN for frontend

---

## 📚 Resources

- **Railway Docs**: https://docs.railway.app
- **Resend Docs**: https://resend.com/docs
- **Echos GitHub**: https://github.com/treadiehq/echos
- **Support**: Open an issue on GitHub

---

## ✅ Post-Deployment Checklist

After deploying:

- [ ] Sign up with your email → Verify magic link works
- [ ] Create organization
- [ ] Generate API key
- [ ] Test workflow from CLI: `npx echos "test task"`
- [ ] Test workflow from code
- [ ] Check traces appear in UI
- [ ] Invite team members
- [ ] Set up monitoring
- [ ] Configure billing alerts
- [ ] Document your API URL for customers
- [ ] Share feedback!

---

Need help? Open an issue: https://github.com/treadiehq/echos/issues

