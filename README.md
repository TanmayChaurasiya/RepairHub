# 🛠️ RepairHub — Vehicle Repair & Service Management Platform

> A production-grade web platform for independent automotive garages in India (starting with Tier-2 cities such as Kanpur). Replaces paper job cards, verbal estimates, and phone tag with a single connected digital workflow between **Vehicle Owners (Customers)**, **Mechanics**, and **Garage Network Admins**.

---

## ⚡ Quick Start: Setup in Under 5 Commands

Follow these 5 commands to spin up the entire database, apply migrations, seed realistic demo data, and run both frontend and backend development servers:

```bash
# 1. Start PostgreSQL 16 database via Docker Compose
docker compose up -d

# 2. Install all backend & frontend dependencies
cd backend && npm install && cd ../frontend && npm install && cd ..

# 3. Apply Prisma database migrations
cd backend && npx prisma migrate deploy

# 4. Seed database with Admin, Kanpur Garage, 3 Mechanics, 2 Customers, Vehicles & Requests
npx tsx prisma/seed.ts && cd ..

# 5. Run both apps concurrently
# Terminal 1 (Backend - http://localhost:5000):
cd backend && npm run dev
# Terminal 2 (Frontend - http://localhost:3000):
cd frontend && npm run dev
```

> **Note for Local Windows/Native PostgreSQL**: If running PostgreSQL locally without Docker, simply configure your database connection string in `backend/.env`:
> `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/repairhub?schema=public"`

---

## 👥 Role-Based Authentication & Access Architecture

RepairHub uses strict role-based access control (RBAC) across four dedicated portals:

| Role | Portal Focus | Access Control |
| :--- | :--- | :--- |
| **MASTER ADMIN** | Central Platform Governance | Exclusive to configured `MASTER_ADMIN_EMAIL` (`mrbindastanmay@gmail.com`). Verified against database role & email. |
| **GARAGE OWNER** | Workshop Fleet & Workforce Command | Independent garage credentials. Verified workshop profile, team invitations & job assignments. |
| **MECHANIC** | Bay Technician Console | Assigned to approved garage. Digital job cards, inspection diagnosis, estimate builder. |
| **CUSTOMER** | Vehicle Owner Portal | Self-registered vehicle owners. Live repair tracking, estimate approvals, UPI payments & PDF invoices. |

---

## 🏗️ Architecture & Core Workflow

### 1. Monorepo Layout
```
placement/
├── .github/workflows/ci.yml   # GitHub Actions CI (lint, typecheck, Prisma migrate, Vitest)
├── docker-compose.yml         # Containerized PostgreSQL 16 service
├── README.md                  # This file
├── backend/                   # Node.js + Express + TypeScript + Prisma ORM
│   ├── prisma/
│   │   ├── schema.prisma      # PostgreSQL models with indexes & enums
│   │   ├── migrations/        # Repeatable SQL migrations
│   │   └── seed.ts            # Realistic Kanpur garage demo data
│   ├── src/
│   │   ├── config/            # Environment parsing (Zod) and DB singleton
│   │   ├── middleware/        # JWT auth, role guard, Zod validator, rate limiters, error handler
│   │   ├── modules/           # Auth, Vehicles, Garages, Mechanics, Requests, Estimates, Invoices, Payments, Reviews, Complaints, Analytics
│   │   ├── services/
│   │   │   ├── stateMachine.ts   # Strict 9-stage state machine validator & transition matrix
│   │   │   ├── assignment.ts     # Pure rule-based smart mechanic ranking algorithm
│   │   │   ├── socket.ts         # Authenticated Socket.IO with user, role & request rooms
│   │   │   ├── payment/          # PaymentProvider interface + MockPaymentProvider
│   │   │   ├── storage/          # StorageProvider interface + LocalStorageProvider
│   │   │   └── pdf/              # PDFKit digital tax invoice generator with ₹ formatting
│   │   ├── app.ts             # Express application assembly
│   │   └── server.ts          # HTTP server & WebSocket listener
│   └── tests/                 # Vitest + Supertest suite (35 unit & integration tests)
└── frontend/                  # Next.js 14 App Router + Tailwind CSS + Lucide
    ├── src/
    │   ├── app/               # Landing page, /login, /register, /customer, /mechanic, /admin
    │   ├── components/        # AppLayout, StatusTimeline, StatusBadge, Modals (Estimate, Payment, Review, Complaint)
    │   ├── context/           # AuthContext (JWT rotation), ToastContext
    │   └── lib/               # Fetch API client, Socket.IO client, formatters (₹ en-IN)
    └── tailwind.config.ts     # Color tokens: Navy (#0B1729), Orange (#FF8A3D), Cyan (#22C7DB)
```

---

### 2. Strict 9-Stage State Machine

The platform enforces a deterministic state machine on the backend. Any unauthorized attempt returns an HTTP `403 Forbidden` or `409 Conflict`:

```
[SUBMITTED]
    │  (Admin assigns mechanic)
    ▼
[ASSIGNED]
    │  (Mechanic starts inspection)
    ▼
[INSPECTING] ◄────────────────────────────────┐
    │                                         │ (Mechanic reopens
    │  (Mechanic builds & sends estimate)     │  to revise estimate)
    ▼                                         │
[ESTIMATE_SENT] ──────────────────────────────┘
    │
    ├─────► [REJECTED] (Customer rejects estimate; mechanic can revise)
    │
    │  (Customer approves estimate)
    ▼
[APPROVED]
    │  (Mechanic begins work — WORK CAN NEVER START BEFORE APPROVAL)
    ▼
[IN_PROGRESS]
    │  (Mechanic sends to Quality Control)
    ▼
[QC]
    │  (Mechanic marks completed; INVOICE GENERATED AUTOMATICALLY)
    ▼
[COMPLETED]
    │  (Customer pays via UPI/Card)
    ▼
[PAID]

Side states:
- CANCELLED: Can be triggered by Customer or Admin before work starts (IN_PROGRESS).
```

- **Audit-Friendly Append-Only Trail**: Every single transition writes a row to `StatusHistory` (`fromStatus`, `toStatus`, `actorId`, `actorRole`, `note`, `timestamp`).
- **Real-Time Push**: Every transition broadcasts a `request:updated` event through authenticated Socket.IO rooms to both customer and mechanic simultaneously.

---

### 3. Pure Rule-Based Smart Mechanic Assignment

The assignment engine (`backend/src/services/assignment.ts`) is a pure, unit-tested function with zero machine-learning dependencies:

#### Hard Filters (Must Pass All):
1. **Availability**: `available === true`
2. **Skill Match**: `mechanic.skills` includes `request.category`
3. **Verified Garage**: `mechanic.garage.isVerified === true`
4. **City Match** (optional): `mechanic.garage.city === requestCity`

#### Scoring Formula:
$$\text{Score} = (\text{Rating} \times 1.0) - (\text{ActiveJobCount} \times 0.5)$$

*Configurable in `ASSIGNMENT_WEIGHTS` (`backend/src/services/assignment.ts`). Higher score ranks first.*

---

### 4. Monetary Precision & Indian Localization
- **Integer Paise Storage**: All prices, parts, labour, invoices, and payment transactions are stored as integer paise in PostgreSQL (e.g. `₹5,400.00` = `540000` paise) to prevent floating-point rounding errors.
- **Indian Locale Formatting**: Displayed everywhere using standard Indian grouping (`₹12,450.00`) through `formatINR()`.

---

## 🔌 Plugging in Production Services (Extension Points)

### 1. Swapping in Razorpay (`PaymentProvider`)
The payment gateway is decoupled behind the `PaymentProvider` interface in `backend/src/services/payment/index.ts`:

```typescript
export interface PaymentProvider {
  createOrder(params: CreateOrderParams): Promise<PaymentOrderResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<boolean>;
}
```

To switch from `MockPaymentProvider` to real Razorpay:
1. Install Razorpay SDK: `cd backend && npm install razorpay`
2. Create `backend/src/services/payment/razorpay.ts`:
```typescript
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { PaymentProvider, CreateOrderParams, PaymentOrderResult, VerifyPaymentParams } from './index.js';

export class RazorpayProvider implements PaymentProvider {
  private instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  async createOrder(params: CreateOrderParams): Promise<PaymentOrderResult> {
    const order = await this.instance.orders.create({
      amount: params.amountPaise,
      currency: 'INR',
      receipt: params.invoiceNumber,
    });
    return {
      orderId: order.id,
      amountPaise: Number(order.amount),
      currency: order.currency,
      provider: 'RAZORPAY',
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<boolean> {
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${params.orderId}|${params.paymentId}`)
      .digest('hex');
    return expected === params.signature;
  }
}
```
3. Export `export const paymentProvider = new RazorpayProvider();` in `index.ts`. No controller logic changes required!

---

### 2. Swapping in AWS S3 (`StorageProvider`)
Local file uploads are abstracted behind the `StorageProvider` interface in `backend/src/services/storage/index.ts`:

```typescript
export interface StorageProvider {
  uploadFile(file: Express.Multer.File, folder?: string): Promise<string>;
  deleteFile(fileUrl: string): Promise<void>;
}
```

To switch from `LocalStorageProvider` to AWS S3:
1. Install AWS SDK: `cd backend && npm install @aws-sdk/client-s3`
2. Create `backend/src/services/storage/s3.ts`:
```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { StorageProvider } from './index.js';

export class S3StorageProvider implements StorageProvider {
  private client = new S3Client({ region: process.env.AWS_REGION! });
  private bucket = process.env.AWS_S3_BUCKET!;

  async uploadFile(file: Express.Multer.File, folder = 'repairs'): Promise<string> {
    const key = `${folder}/${Date.now()}-${file.originalname}`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));
    return `https://${this.bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    const key = fileUrl.split('.com/')[1];
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
```
3. Update `export const storageProvider = new S3StorageProvider();`.

---

## 📡 REST API Reference

All protected endpoints require an `Authorization: Bearer <accessToken>` header.

### Authentication (`/api/auth`)
- `POST /register`: Self-registration for Customers (`name`, `email`, `phone`, `password`)
- `POST /login`: Issues access token (15m) + refresh token (7d)
- `POST /refresh-token`: Refresh token rotation
- `POST /logout`: Revokes refresh token
- `GET /me`: Returns authenticated profile and role

### Vehicles (`/api/vehicles`)
- `GET /`: List customer's vehicles
- `POST /`: Add a vehicle (`type`: `TWO_WHEELER` | `CAR` | `COMMERCIAL`, `make`, `model`, `year`, `regNo`)
- `GET /:id`: Vehicle details + service history
- `PUT /:id`: Update vehicle details
- `DELETE /:id`: Remove vehicle

### Repair Requests (`/api/requests`)
- `GET /`: List requests (scoped by role: customer sees own, mechanic sees assigned, admin sees all; supports `?status=`, `?category=`, `?search=`)
- `POST /`: Customer creates request (`vehicleId`, `garageId`, `category`, `description`, `photos[]`)
- `GET /:id`: Comprehensive request details (vehicle, customer, mechanic, estimate, history, invoice, payment, review)
- `GET /:id/suggestions`: (Admin) Returns ranked mechanic candidates with scores and active workload
- `POST /:id/assign`: (Admin) Assign mechanic (`mechanicId` or `autoAssign: true`)
- `POST /:id/transition`: Advance workflow state (`targetStatus`, `note`)
- `PUT /:id/diagnosis`: (Mechanic) Record diagnostic notes and inspection findings
- `POST /:id/photos`: Upload vehicle inspection images (multipart)

### Estimates (`/api/estimates`)
- `POST /request/:requestId`: (Mechanic) Create and send new estimate version (`items`: `[{ kind, description, quantity, unitPricePaise }]`)
- `POST /request/:requestId/reopen`: (Mechanic) Reopen `ESTIMATE_SENT` or `REJECTED` back to `INSPECTING` for revision
- `POST /:estimateId/decision`: (Customer) Approve or reject estimate (`decision`: `'APPROVE'` | `'REJECT'`, `customerNote`)

### Invoices & Payments (`/api/invoices`, `/api/payments`)
- `GET /invoices/:id`: Get invoice details
- `GET /invoices/:id/pdf`: Download digital PDF tax invoice with Indian GST format
- `POST /payments/create-order`: Create payment order with payment provider
- `POST /payments/confirm`: Confirm payment completion (`requestId`, `orderId`, `paymentId`, `signature`)

### Reviews & Complaints (`/api/reviews`, `/api/complaints`)
- `POST /reviews`: Customer submits 1-5 star review + comment after payment
- `POST /complaints`: Customer raises complaint for a request
- `GET /complaints`: List complaints (customer sees own, admin sees all)
- `POST /complaints/:id/resolve`: (Admin) Record resolution notes and mark resolved

### Analytics (`/api/analytics`)
- `GET /dashboard`: (Admin) High-level KPIs: Total revenue in ₹ paise, active mechanics, stage counts, average ratings

---

## 🧪 Automated Testing Suite

The repository contains 35 backend tests built with **Vitest** and **Supertest**:

```bash
cd backend && npm test
```

### Test Coverage Highlights:
1. **Unit: State Machine (`tests/unit/stateMachine.test.ts`)**
   - Verified all 11 allowed transitions (`SUBMITTED → ASSIGNED`, `INSPECTING → ESTIMATE_SENT`, `ESTIMATE_SENT → APPROVED`, etc.)
   - Verified 403 Forbidden checks for unauthorized roles
   - Verified 409 Conflict checks for illegal skips (e.g. jumping from `SUBMITTED` directly to `COMPLETED`)
2. **Unit: Smart Assignment (`tests/unit/assignment.test.ts`)**
   - Verified hard filtering on availability, skill matching, garage verification, and city
   - Verified ranking scoring formula: `rating - (activeJobCount * 0.5)`
3. **Integration: Full Lifecycle (`tests/integration/fullFlow.test.ts`)**
   - Full end-to-end happy path from registration to payment and review
   - Customer cross-tenant isolation (customer cannot view another customer's request)
   - Enforcement of rule: Work (`IN_PROGRESS`) can NEVER start without approved estimate
   - Enforcement of rule: Payment is only allowed when status is `COMPLETED`
   - Enforcement of rule: Superseded estimate cannot be approved

---

## 🚀 Live Verification

Both frontend and backend dev servers run locally:
- **Frontend Web App**: `http://localhost:3000`
- **Backend API Server**: `http://localhost:5000`
- **Healthcheck Endpoint**: `http://localhost:5000/health`
- **Real-Time Live Sync**: WebSocket connection via Socket.IO on port 5000
