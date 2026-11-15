# 🚀 RepairHub — Production Deployment & Go-Live Guide

This comprehensive guide outlines the step-by-step procedure to take the entire **RepairHub** platform (Next.js 14 frontend + Node.js/Express TypeScript backend + PostgreSQL database + Gmail SMTP + Socket.IO) live online on the internet with automatic SSL, CI/CD, and high availability.

---

## 📋 Architectural Overview for Production

```mermaid
flowchart TD
    subgraph Client["Users & Devices"]
        U1["🚗 Customers"]
        U2["🔧 Mechanics"]
        U3["🏢 Garage Owners"]
        U4["👑 Master Admin"]
    end

    subgraph CDN["Edge & Frontend (Vercel)"]
        FE["Next.js 14 App Router\n(https://repairhub.vercel.app)"]
    end

    subgraph Compute["Backend Web Service (Render / Railway)"]
        BE["Express.js + TypeScript API\n+ Socket.IO Listener\n(https://api-repairhub.onrender.com)"]
        cron["Startup: Master Admin Verification\n& SMTP Connection Check"]
    end

    subgraph Data["Database & Services"]
        DB[("PostgreSQL 16\n(Neon / Supabase / Render PG)")]
        SMTP["Gmail SMTP Server\n(smtp.gmail.com:587)"]
    end

    Client -->|HTTPS| FE
    FE -->|REST API / HTTPS| BE
    BE -->|Prisma Client (SSL)| DB
    BE -->|STARTTLS / App Password| SMTP
```

---

## 🎯 Recommended Production Stack (Zero-Cost / High-Tier Starter)

| Component | Platform | Why |
| :--- | :--- | :--- |
| **Frontend** | [Vercel](https://vercel.com) | Official Next.js host, global CDN, instant deployments, automatic SSL. |
| **Backend** | [Render](https://render.com) or [Railway](https://railway.app) | Full Node.js environment, persistent process support for Socket.IO WebSockets. |
| **Database** | [Neon](https://neon.tech) or [Supabase](https://supabase.com) | Managed serverless PostgreSQL 16 with automatic connection pooling and SSL. |
| **Email Service** | [Google Workspace / Gmail SMTP](https://myaccount.google.com/apppasswords) | Reliable delivery to customer and garage owner inboxes via STARTTLS. |

---

## 🛠️ Step-by-Step Deployment Walkthrough

---

### Step 1: Push Code to GitHub

Make sure your latest codebase is pushed to a private or public GitHub repository.

```bash
git add .
git commit -m "feat: complete multi-garage management and Master Admin security"
git push origin main
```

---

### Step 2: Create a Cloud PostgreSQL Database (Neon or Supabase)

#### Option A: Using Neon (Recommended & Fast)
1. Go to [neon.tech](https://neon.tech) and create a free account.
2. Click **Create Project**, name it `repairhub-db`, and choose a region close to your users (e.g., `AWS Asia Pacific (Mumbai)` or `Singapore`).
3. Once created, copy the **Connection String** (`DATABASE_URL`).
   It looks like:
   ```text
   postgresql://repairhub_owner:npg_xxxxxx@ep-cool-fog-123456.ap-southeast-1.aws.neon.tech/repairhub?sslmode=require
   ```

#### Option B: Using Supabase
1. Go to [supabase.com](https://supabase.com) and create a project.
2. Under **Project Settings > Database**, find **Connection string (URI)**.
3. Use the pooled connection string with `?sslmode=require`.

---

### Step 3: Configure Gmail SMTP App Password

RepairHub sends transactional emails (password reset links, mechanic invitations, garage approval notifications) using Gmail SMTP.

1. Log into your Google Account for **mrbindastanmay@gmail.com**.
2. Navigate to [Google Account Security](https://myaccount.google.com/security).
3. Ensure **2-Step Verification** is turned **ON**.
4. In the search bar inside Google Account, type **"App passwords"** (or visit [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
5. Name the app: `RepairHub Production`.
6. Click **Create**. Google will generate a **16-character password** (e.g., `abcd efgh ijkl mnop`).
7. Save this password securely (without spaces).

---

### Step 4: Deploy the Backend API on Render / Railway

#### Using Render:
1. Sign up / Log in to [render.com](https://render.com).
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository.
4. Fill in the service settings:
   - **Name**: `repairhub-api`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Region**: Choose closest to your database (e.g., Singapore / Frankfurt)
   - **Branch**: `main`
   - **Build Command**:
     ```bash
     npm install && npx prisma generate && npm run build
     ```
   - **Start Command**:
     ```bash
     npx prisma migrate deploy && npm run start
     ```
   - **Instance Type**: `Free` or `Starter` ($7/mo recommended for 24/7 uptime without cold starts).

5. Scroll down to **Environment Variables** and add the following keys:

| Environment Variable | Production Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security & logging |
| `PORT` | `5000` (Render sets its own `$PORT`, Express will adapt) | API Port |
| `DATABASE_URL` | *(Pasted from Neon/Supabase)* | Cloud PostgreSQL connection string |
| `JWT_SECRET` | *(Generate a 64-char random string)* | Access Token signing key |
| `JWT_REFRESH_SECRET` | *(Generate a 64-char random string)* | Refresh Token signing key |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Token expiration duration |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh session duration |
| `CORS_ORIGIN` | `https://your-frontend.vercel.app` *(update after Step 5)* | Permitted frontend domain |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` *(update after Step 5)* | Password reset base URL |
| `SMTP_HOST` | `smtp.gmail.com` | Google SMTP server |
| `SMTP_PORT` | `587` | STARTTLS port |
| `SMTP_USER` | `mrbindastanmay@gmail.com` | Sender Gmail address |
| `SMTP_PASS` | `your16characterapppassword` | Generated Google App Password |
| `EMAIL_FROM` | `RepairHub <mrbindastanmay@gmail.com>` | Email Display Name & Address |
| `MASTER_ADMIN_EMAIL` | `mrbindastanmay@gmail.com` | Exclusive Master Admin identity |
| `MASTER_ADMIN_INITIAL_PASSWORD` | `YourMasterPassword2026!` | Initial Master Admin password |
| `PAYMENT_PROVIDER` | `MOCK` *(or `RAZORPAY`)* | Payment engine mode |

> 💡 **Tip to generate JWT secrets in terminal:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

6. Click **Deploy Web Service**.
7. Render will build the TypeScript project, apply Prisma migrations, and start the server.
8. Your backend URL will be: `https://repairhub-api.onrender.com`.
9. Test it by opening in your browser: `https://repairhub-api.onrender.com/health`.
   It should return:
   ```json
   { "status": "ok", "service": "RepairHub Backend API" }
   ```

---

### Step 5: Deploy the Frontend on Vercel

1. Sign up / Log in to [vercel.com](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Import your GitHub repository.
4. In the **Configure Project** window:
   - **Project Name**: `repairhub`
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click **Edit** and select `frontend`.
5. Expand **Environment Variables** and add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://repairhub-api.onrender.com/api` | Full URL to backend API |
| `NEXT_PUBLIC_SOCKET_URL` | `https://repairhub-api.onrender.com` | Base backend URL for WebSockets |

6. Click **Deploy**.
7. In ~60 seconds, Vercel will provide your production URL:
   `https://repairhub.vercel.app` (or your custom domain).

---

### Step 6: Connect Backend and Frontend Domains (Final Cross-Origin Link)

Now that you have your live frontend URL (e.g. `https://repairhub.vercel.app`):

1. Go back to your backend hosting dashboard (**Render > Environment Variables**).
2. Update the following two variables:
   - `CORS_ORIGIN` = `https://repairhub.vercel.app`
   - `FRONTEND_URL` = `https://repairhub.vercel.app`
3. Click **Save Changes**. Render will automatically redeploy with the updated origin.

---

### Step 7: (Optional) Seed Initial Data

Your Master Admin account (`mrbindastanmay@gmail.com`) is **automatically created on first startup** by the backend initialization service (`initializeMasterAdmin`).

If you also wish to seed demo garages, mechanics, and test vehicles into your cloud database:
Run this once from your local computer pointed to the cloud database:

```bash
# In your local backend folder:
DATABASE_URL="your_neon_or_supabase_cloud_url" npx tsx prisma/seed.ts
```

---

## 🔒 Verification & Go-Live Acceptance Checklist

Once both services are deployed, perform the following verification:

- [ ] **1. Master Admin Login**:
  - Visit `https://repairhub.vercel.app/login`
  - Select the **Admin** tab.
  - Login with `mrbindastanmay@gmail.com` and your configured password.
  - Confirm access to `/admin` dashboard.

- [ ] **2. Customer Portal & Repair Request**:
  - Open an Incognito window and register a new customer.
  - Add a vehicle and submit a repair request.

- [ ] **3. Garage Owner Portal**:
  - Register a new garage workshop (`/register-garage`).
  - Log in as Master Admin and approve the garage.
  - Log back in as the Garage Owner and verify the workshop dashboard.

- [ ] **4. Email Delivery Test**:
  - On `/forgot-password`, enter `mrbindastanmay@gmail.com` and click **Send Reset Link**.
  - Check your Gmail inbox and verify receipt of the branded reset email.
  - Click the reset link to verify password updates work in production.

---

## 🌐 Custom Domain Setup (Optional)

If you have a custom domain like `repairhub.in`:

1. **Frontend (`repairhub.in` & `www.repairhub.in`)**:
   - In Vercel > Settings > Domains, add `repairhub.in`.
   - In your DNS provider (GoDaddy, Namecheap, Cloudflare), set:
     - `A` Record `@` -> `76.76.21.21`
     - `CNAME` Record `www` -> `cname.vercel-dns.com`

2. **Backend (`api.repairhub.in`)**:
   - In Render > Settings > Custom Domains, add `api.repairhub.in`.
   - In your DNS provider, set:
     - `CNAME` Record `api` -> `repairhub-api.onrender.com`
3. Update `NEXT_PUBLIC_API_URL` to `https://api.repairhub.in/api` on Vercel.
4. Update `CORS_ORIGIN` and `FRONTEND_URL` to `https://repairhub.in` on Render.

