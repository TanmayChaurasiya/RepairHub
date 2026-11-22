# 🛠️ RepairHub — Multi-Garage Management Architecture Progress Tracker

## 📋 1. Project Architecture Analysis

RepairHub has been upgraded from a single-garage workflow into a production-ready, scalable **Multi-Garage Management Platform** enforcing a strict 4-role hierarchy:

1. **Master Admin (`ADMIN`)**: Highest platform authority with oversight across all garages, mechanics, customers, bookings, revenue, and immutable audit logs. Capable of approving, rejecting, suspending, and reactivating any garage or mechanic across the entire network.
2. **Garage Owner (`GARAGE`)**: Independent garage account with strict multi-tenant isolation. Manages garage profile, operating hours, supported services, mechanic team (invitations, approvals, workload assignments), and service bookings.
3. **Mechanic (`MECHANIC`)**: Assigned strictly to one garage. Receives service requests, manages inspection, diagnostics, estimates, and repair execution. Onboarded via Garage Owner invitation.
4. **Customer (`CUSTOMER`)**: Self-registers, adds vehicles, browses approved garages, books repairs, approves estimates, makes digital payments, and submits reviews.

---

## 🏗️ 2. Implementation Phases & Completion Status

- [x] **Phase 1: Database & Role Architecture**
  - Updated `Role` enum with `GARAGE`.
  - Added `GarageStatus` (`PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`) and `MechanicStatus` (`PENDING`, `ACTIVE`, `REJECTED`, `SUSPENDED`).
  - Added `ownerId` relation on `Garage` to `User`.
  - Added `MechanicInvitation` model for secure, single-use, hashed-token mechanic invitations.
  - Added `AuditLog` model for immutable system-wide activity recording.
  - Deployed non-destructive Prisma migration: `20261115060000_multi_garage_architecture`.
  - Updated Prisma client and seed scripts with realistic demo accounts.

- [x] **Phase 2: Backend Authentication & Authorization**
  - Extended JWT generation with `Role.GARAGE` and `ownedGarage` profile payload.
  - Implemented `resolveGarageOwnership` and `requireApprovedGarage` in `backend/src/middleware/garageAuth.ts`.
  - Strictly prevents garage tenant escalation (garage ID is derived exclusively from the authenticated user's database record).

- [x] **Phase 3: Garage Registration & Master Admin Approval**
  - Implemented `POST /api/garages/register` (public self-registration with status `PENDING`).
  - Implemented Master Admin garage management endpoints:
    - `GET /api/admin/garages` (multi-status filter, search, revenue & mechanic counts).
    - `GET /api/admin/garages/:id` (detailed view with audit history).
    - `POST /api/admin/garages/:id/approve` (sets `APPROVED`, `isVerified: true`, sends email).
    - `POST /api/admin/garages/:id/reject` (sets `REJECTED`, records reason, sends email).
    - `POST /api/admin/garages/:id/suspend` (locks garage operations).
    - `POST /api/admin/garages/:id/reactivate` (restores active status).
  - Created Frontend Garage Registration Page: `frontend/src/app/garage/register/page.tsx`.
  - Created Frontend Application Status Tracker: `frontend/src/app/garage/status/page.tsx`.

- [x] **Phase 4: Complete Garage Owner Portal**
  - Implemented `GET /api/garage/dashboard` (KPIs: bookings, active technicians, monthly revenue).
  - Implemented `GET /api/garage/profile`, `PUT /api/garage/profile` (profile settings & services).
  - Implemented `GET /api/garage/bookings`, `POST /api/garage/bookings/:id/assign`.
  - Created Frontend Garage Overview Dashboard: `frontend/src/app/garage/page.tsx`.
  - Created Frontend Bookings Manager: `frontend/src/app/garage/bookings/page.tsx`.
  - Created Frontend Workshop Profile Editor: `frontend/src/app/garage/profile/page.tsx`.

- [x] **Phase 5: Garage-Based Mechanic Registration & Approval**
  - Transferred routine mechanic onboarding authority from Master Admin to Garage Owner.
  - Implemented `POST /api/garage/mechanics/invite` (generates cryptographic single-use invitation token and dispatches email).
  - Implemented `GET /api/garage/mechanics` and `PATCH /api/garage/mechanics/:id/status`.
  - Implemented public endpoints: `GET /api/mechanics/invitation/:token` and `POST /api/mechanics/accept-invitation`.
  - Created Frontend Mechanic Team Page: `frontend/src/app/garage/mechanics/page.tsx`.
  - Created Frontend Invitation Acceptance Page: `frontend/src/app/mechanic/accept-invitation/page.tsx`.

- [x] **Phase 6: Master Admin Platform Supervision**
  - Implemented `GET /api/admin/mechanics` (cross-garage mechanic roster).
  - Implemented Master Admin overrides: `POST /api/admin/mechanics/:id/suspend` and `reactivate`.
  - Implemented `GET /api/admin/customers` and `GET /api/admin/bookings`.
  - Implemented `GET /api/admin/analytics/comparison` for garage benchmarking.
  - Created Frontend Master Admin Garages Manager: `frontend/src/app/admin/garages/page.tsx`.
  - Created Frontend Master Admin Mechanics Oversight: `frontend/src/app/admin/mechanics/page.tsx`.

- [x] **Phase 7: System Audit Logging**
  - Created `backend/src/services/audit/audit.service.ts`.
  - Recorded audit logs for garage registrations, approvals, rejections, suspensions, mechanic invitations, and job assignments.
  - Implemented `GET /api/admin/audit-logs`.
  - Created Frontend Audit Trail View: `frontend/src/app/admin/audit-logs/page.tsx`.

- [x] **Phase 8: Frontend 4-Role Login & App Layout**
  - Upgraded `frontend/src/app/login/page.tsx` with 4 dedicated role selectors:
    - Master Admin (`ADMIN`): Exclusive identity `mrbindastanmay@gmail.com`
    - Garage Owner (`GARAGE`): Independent workshop credentials
    - Mechanic (`MECHANIC`): Technician workforce credentials
    - Customer (`CUSTOMER`): Vehicle owner credentials
  - Removed all demo pre-fill buttons and auto-login credentials.
  - Dynamic routing based on role and garage approval status.
  - Updated `AppLayout.tsx` with dedicated sidebar navigations for all 4 roles.

- [x] **Phase 9: Automated Testing & Verification**
  - Added comprehensive integration test suite: `backend/tests/integration/multiGarage.test.ts`.
  - Full test suite passes: **53 tests passing across 5 test suites (100% pass rate)**.
  - Validated multi-tenant isolation, status transitions, and invite flows.

- [x] **Phase 10: Production Verification & Build**
  - `npm run typecheck` passed on backend and frontend (0 errors).
  - `next build` compiled all 26 static & dynamic pages successfully.
  - Development servers active on `http://localhost:3000` and `http://localhost:5000`.
  - Public tunnel active at `https://neat-queens-hide.loca.lt`.

- [x] **Phase 11: Demo Credential Removal & Exclusive Master Admin Architecture**
  - Purged hardcoded demo credentials across frontend, backend, landing pages, login pages, and seeders.
  - Configured exclusive Master Admin identity: `mrbindastanmay@gmail.com`.
  - Strict server-side portal validation: reserved admin email rejected from customer/mechanic/garage registration and non-admin login.
  - Server-side authorization middleware verifies both JWT claims and database role/email against `MASTER_ADMIN_EMAIL`.
  - Master Admin initialization bootstrap service (`adminInit.service.ts`) ensures role integrity and purges legacy demo admin.
  - Comprehensive automated security test suite: `backend/tests/integration/masterAdminSecurity.test.ts`.

- [x] **Phase 12: Progressive Web App (PWA) Implementation & Mobile Architecture**
  - Converted existing Next.js 14 App Router application into a production-ready, installable PWA for Android, iOS, and Desktop without breaking changes or third-party bloat.
  - Authored standard Web App Manifest (`manifest.webmanifest` & `manifest.json`) with standalone display mode, orientation lock, brand colors (`#0f172a`, `#ffffff`), and quick action shortcuts.
  - Generated full set of crisp, brand-aligned icons: 192x192, 512x512, 512x512 maskable, apple-touch-icon (180x180), and SVG vector asset.
  - Built custom, production-safe Service Worker (`public/sw.js`):
    - Strict security bypass: Never caches `/api/*`, `/socket.io/*`, authentication routes, or JWT tokens.
    - Network-first navigation strategy with automatic fallback to branded `/offline` page.
    - Cache-first with background revalidation for static assets (`_next/static`, icons, fonts).
    - Automatic legacy cache cleanup and client claim on activation.
    - Integrated Web Push notification and click-handling listeners.
  - Created responsive PWA Install Experience (`PWAInstallPrompt.tsx`):
    - Android/Chromium native `beforeinstallprompt` hook with "Install RepairHub App" banner and header/sidebar button integration.
    - iOS Safari detection with step-by-step "Add to Home Screen" visual guide modal.
    - Standalone mode auto-detection (`display-mode: standalone`) to suppress prompts when already installed.
  - Implemented mobile UI/UX optimization:
    - Viewport configuration with `viewportFit: 'cover'`.
    - iOS notch and home-bar safe area padding (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`).
    - Accessible touch targets (minimum 44px) across navigation, drawer, and action buttons.
    - Mobile drawer responsive install trigger.
    - Mobile-safe toast notification container.
  - Added push notification permission and local notification dispatch utility (`pushNotifications.ts`).
  - Verified with full Next.js production build (27 routes including `/offline`) and TypeScript typecheck (0 errors).

---

## 📁 3. Files Created & Modified

### Backend:
- `backend/prisma/schema.prisma` (Added `Role.GARAGE`, `GarageStatus`, `MechanicStatus`, `ownerId`, `MechanicInvitation`, `AuditLog`)
- `backend/prisma/migrations/20261115060000_multi_garage_architecture/migration.sql` (Safe SQL migration)
- `backend/prisma/seed.ts` & `backend/scripts/seed_multigarage.js` (Multi-garage demo seeding)
- `backend/src/types/index.ts` (Extended `AuthenticatedRequest` with `garage?: Garage`)
- `backend/src/middleware/garageAuth.ts` (`resolveGarageOwnership`, `requireApprovedGarage`)
- `backend/src/services/audit/audit.service.ts` (`logAudit` helper)
- `backend/src/services/email/mailer.ts` (Added `sendGenericEmail`)
- `backend/src/modules/auth/auth.controller.ts` (Included `ownedGarage` in login & me)
- `backend/src/modules/garages/garage.schema.ts` (Added `registerGarageSchema`, `updateGarageProfileSchema`)
- `backend/src/modules/garages/garage.controller.ts` (Added `registerGarage`, status filtering)
- `backend/src/modules/garages/garage.routes.ts` (Public `POST /register`, `GET /:id`)
- `backend/src/modules/garageOwner/garageOwner.controller.ts` (Dashboard, profile, bookings, mechanics, invites)
- `backend/src/modules/garageOwner/garageOwner.routes.ts` (Mounted at `/api/garage`)
- `backend/src/modules/mechanics/mechanic.schema.ts` (Added `acceptInvitationSchema`)
- `backend/src/modules/mechanics/mechanic.controller.ts` (Added `getInvitationDetails`, `acceptInvitation`)
- `backend/src/modules/mechanics/mechanic.routes.ts` (Public `/invitation/:token`, `/accept-invitation`)
- `backend/src/modules/admin/admin.controller.ts` (Master Admin garages, mechanics, bookings, audit logs, comparison)
- `backend/src/modules/admin/admin.routes.ts` (Mounted at `/api/admin`)
- `backend/src/app.ts` (Mounted `/api/garage` and `/api/admin`)
- `backend/tests/integration/multiGarage.test.ts` (10 automated end-to-end tests)

### Frontend:
- `frontend/src/context/AuthContext.tsx` (Added `Role.GARAGE`, `ownedGarage`, `setAuthData`)
- `frontend/src/components/layout/AppLayout.tsx` (Added `GARAGE` and `ADMIN` sidebars, iOS notch/home-bar safe area insets, touch-friendly min 44px targets, `InstallAppButton`)
- `frontend/src/app/layout.tsx` (Added `viewport` metadata with `viewportFit: cover`, manifest links, `appleWebApp` metadata, `ServiceWorkerRegistration`, `PWAInstallPrompt`)
- `frontend/src/app/globals.css` (Added safe area classes, standalone app tap-highlight optimizations, touch target helpers)
- `frontend/src/context/ToastContext.tsx` (Mobile safe-area positioning & responsive width)
- `frontend/public/manifest.webmanifest` & `frontend/public/manifest.json` (PWA web manifest)
- `frontend/public/sw.js` (Custom production-safe Service Worker with security bypass & offline fallback)
- `frontend/public/icons/` (`icon-192x192.png`, `icon-512x512.png`, `icon-maskable-512x512.png`, `apple-touch-icon.png`, `icon.svg`, `favicon.ico`)
- `frontend/src/app/offline/page.tsx` (Branded offline fallback page with live connection detector)
- `frontend/src/components/pwa/ServiceWorkerRegistration.tsx` (Client-side SW registration and update lifecycle)
- `frontend/src/components/pwa/PWAInstallPrompt.tsx` (Android `beforeinstallprompt`, iOS Safari modal, install button)
- `frontend/src/lib/pushNotifications.ts` (Notification permissions and local notification dispatcher)
- `frontend/scripts/generate-icons.ps1` (High-resolution icon generation script)
- `frontend/src/app/login/page.tsx` (4-role selector, 1-click demo logins, role routing)
- `frontend/src/app/garage/register/page.tsx` (Workshop self-registration form)
- `frontend/src/app/garage/status/page.tsx` (Pending, Rejected, Suspended status tracking)
- `frontend/src/app/garage/page.tsx` (Garage overview dashboard, KPI cards, recent requests)
- `frontend/src/app/garage/bookings/page.tsx` (Garage bookings manager with mechanic assignment)
- `frontend/src/app/garage/mechanics/page.tsx` (Mechanics team table, invite modal, URL copy)
- `frontend/src/app/garage/profile/page.tsx` (Workshop profile & repair services editor)
- `frontend/src/app/mechanic/accept-invitation/page.tsx` (Public mechanic password setup)
- `frontend/src/app/admin/garages/page.tsx` (Master Admin garage approval/rejection/suspension manager)
- `frontend/src/app/admin/mechanics/page.tsx` (Platform-wide mechanic oversight & overrides)
- `frontend/src/app/admin/audit-logs/page.tsx` (System audit trail with action filtering)

---

## 🧪 4. Testing Results

### Backend Automated Test Suite:
All 53 automated integration and unit tests passing cleanly (100% pass rate):
```bash
cd backend && npm test
```
```text
 ✓ tests/unit/assignment.test.ts (7 tests)
 ✓ tests/unit/stateMachine.test.ts (22 tests)
 ✓ tests/integration/fullFlow.test.ts (6 tests)
 ✓ tests/integration/passwordReset.test.ts (8 tests)
 ✓ tests/integration/multiGarage.test.ts (10 tests)

 Test Files  5 passed (5)
      Tests  53 passed (53)
   Duration  4.96s
```

### Frontend Typecheck & Production Build:
```bash
cd frontend && npm run typecheck
cd frontend && npm run build
```
- **TypeScript Check**: `tsc --noEmit` passed with **0 errors**.
- **Next.js Production Build**: **27 routes compiled successfully** (including `/offline`, manifests, and all role dashboards).
- **Service Worker & Manifest Verification**:
  - `GET /manifest.webmanifest` -> 200 OK (`application/manifest+json`)
  - `GET /sw.js` -> 200 OK (`application/javascript`)
  - `GET /offline` -> 200 OK
  - `GET /icons/icon-192x192.png` -> 200 OK (`image/png`)
  - `GET /icons/icon-512x512.png` -> 200 OK (`image/png`)
  - `GET /icons/icon-maskable-512x512.png` -> 200 OK (`image/png`)

---

## 📱 5. PWA Mobile Installation & User Experience Guide

### Android (Google Chrome, Edge, Brave, Samsung Internet):
1. Navigate to RepairHub (e.g. `https://repair-hub-ecru.vercel.app` or `http://localhost:3000`).
2. An **"Install RepairHub App"** banner appears automatically at the bottom, or click the **"Install App"** button located in the sidebar / mobile menu.
3. Tap **"Install"**; the native Android install dialog opens.
4. Once confirmed, RepairHub is placed directly on the home screen and app drawer with the high-resolution RepairHub icon.
5. Launches into a full-screen, standalone application window without browser URL bars or navigation clutter.

### iOS / iPadOS (Apple Safari):
1. Open RepairHub in **Safari** on iPhone or iPad.
2. Tap the **"Install App"** button in the top/drawer menu to view the visual step-by-step instructions.
3. Tap the Safari **Share** icon (square with arrow pointing up) in the navigation bar.
4. Scroll down the share sheet and select **"Add to Home Screen"**.
5. Tap **"Add"** in the top-right corner.
6. The app launches with standalone iOS status bar theming, notch and home-bar safe area adaptation, and isolated standalone web application storage.

### Security & Privacy Architecture:
- **No Token Caching**: JWT tokens and private profile data are never stored in CacheStorage.
- **Dynamic Data Integrity**: All API calls (`/api/*`), WebSockets (`/socket.io`), and database transactions always bypass the Service Worker cache and require live network access.
- **Graceful Offline Fallback**: If network drops, users receive the branded `/offline` screen with a live connectivity status detector and emergency workshop phone numbers instead of a raw browser dinosaur crash screen.

---

## 🚀 6. Phase 13: Admin Intelligence, Mechanic Reassignment & Automation Enhancement

### A. Feature Overview & Architecture

1. **Mechanic Reassignment System (Admin-Only)**:
   - **Inspection State Invariant Guard**: Admins can reassign mechanics when `request.status === 'ASSIGNED'`. Once technical inspection begins (`INSPECTING`, `ESTIMATE_SENT`, `IN_PROGRESS`, etc.), reassignment is strictly blocked (HTTP 400/409) to preserve technical chain of custody.
   - **Optimistic Concurrency Control**: Uses `expectedUpdatedAt` locking to prevent race conditions and stale assignment overrides.
   - **Smart Recommendation Engine**: Evaluates verified garages in the request city, certified repair skills (`ENGINE`, `BRAKES`, `SUSPENSION`, etc.), current real-time availability (`AVAILABLE`), and workload penalty (`Rating - (ActiveJobs * 0.5)`).
   - **Audit Trail & Dual Notification**: Every reassignment records an immutable `AssignmentHistory` entry (tracking previous mechanic, new mechanic, admin actor, reason, timestamp), creates an `AuditLog`, broadcasts live via Socket.IO (`request:updated`), and dispatches email alerts to both previous and new mechanics via Brevo/SMTP.
   - **Frontend UI**: Integrated into `/admin/requests/[id]` with an interactive Reassignment Modal (enforcing >= 5-char mandatory reason) and a dedicated **Technician Assignment History** chronological timeline.

2. **Garage & Mechanic Account Details (Admin Read-Only Drawers)**:
   - **Garage Profile Drawer** (`/admin/garages`): Clickable garage cards/rows opening a slide-over drawer displaying owner information, contact details, operating hours, active workshop operating status, certified service list, active mechanics roster, and verification actions.
   - **Mechanic Profile Drawer** (`/admin/mechanics`): Clickable mechanic cards/rows displaying full profile, contact info, assigned garage, certified skills, real-time availability indicator, active repair jobs, and rating stats.

3. **Customer Vehicle Management** (`/admin/vehicles`):
   - Comprehensive platform vehicle directory listing all customer-registered vehicles.
   - Includes real-time search by customer name, email, vehicle make, model, and registration number.
   - Multi-category filtering (`CAR`, `TWO_WHEELER`, `COMMERCIAL`) and pagination.
   - Clickable vehicle drawer detailing vehicle specifications, customer account details, other vehicles owned by the customer, and complete repair history.

4. **Automated Vehicle Availability Email Notifications**:
   - Asynchronous, non-blocking background job triggered upon vehicle creation (`POST /api/vehicles`).
   - Checks garage operating hours (`isWithinOperatingHours`) and on-duty mechanic availability matching the vehicle category.
   - Dispatches responsive HTML email:
     - **Template A (Mechanics Available)**: Informs customer that compatible certified mechanics are currently available, with direct booking links.
     - **Template B (Specialists Occupied / Off-Hours)**: Informs customer of peak hours and provides garage directory exploration links.
   - **Duplicate Guard**: Checks existing `EmailNotification` records to prevent duplicate emails for the same vehicle.
   - **Admin Email Notifications Dashboard** (`/admin/email-notifications`): Real-time delivery audit table tracking status (`SENT`, `PENDING`, `FAILED`), error details, and 1-click retry.

5. **Mechanic Real-Time Availability System**:
   - 4-State dispatch system:
     - 🟢 `AVAILABLE`: Available for job dispatch.
     - 🟡 `BUSY`: Actively working on repair bay jobs. Automatically set when inspection or repair begins.
     - ☕ `ON_BREAK`: Stepped away with quick break reason presets (*Lunch Break*, *Parts Pickup*, *Short Rest*, *Personal Break*) or custom reason.
     - ⚫ `OFFLINE`: Off-duty.
   - Auto-reverts to `AVAILABLE` on job completion (`COMPLETED`/`CANCELLED`) if active bay queue is clear.
   - Real-time Socket.IO event `mechanic:availability_updated` broadcasts status changes to Admin, Garage Owner, and Mechanic dashboards.

6. **Admin Dashboard Overview Enhancements** (`/admin`):
   - Real-time stat metrics showing total registered customer vehicles, active mechanics on duty, email notification deliveries, and pending reassignment counts.
   - Direct quick-navigation cards linking to Customer Vehicles, Assignment History, and Email Notification logs.

---

### B. Automated Verification & Production Builds

- **Integration Test Suite**: `backend/tests/integration/reassignmentAndAutomation.test.ts`
  - **14/14 Tests Passed (100% Success)**:
    - Real-time availability toggles (`AVAILABLE`, `ON_BREAK`, break reasons, unauthorized rejection).
    - Asynchronous vehicle registration availability email dispatch via Brevo.
    - Duplicate email prevention guard.
    - Customer vehicle directory pagination, filtering, and full detail view.
    - Email notifications audit table.
    - Admin mechanic reassignment with candidate ranking and validation.
    - Reassignment lock guard when vehicle inspection commences (`INSPECTING`).
    - Immutable assignment history tracking.
- **Backend Typecheck & Build**:
  - `tsc --noEmit`: Passed with 0 errors.
  - `tsc`: Production build succeeded.
- **Frontend Typecheck & Build**:
  - `tsc --noEmit`: Passed with 0 errors.
  - `next build`: **30/30 routes compiled and statically optimized successfully**.


---

## [Phase 14] Emergency Assistance & Roadside Support System (SOS)

### 1. Architectural Overview & Objectives
Implemented a comprehensive, mission-critical 24x7 Emergency Assistance and Roadside Support System for RepairHub across Kanpur:
- **Distress Location & Navigation**: GPS auto-detection with fallback manual Leaflet map pin placement.
- **Provider Discovery & Route ETA**: Haversine distance calculations, configurable radius (10km - 40km), urban transit speeds (~25 km/h + 5 min dispatch buffer).
- **Incident State Machine**: `REQUESTED` ➔ `SEARCHING` ➔ `PENDING_ACCEPTANCE` ➔ `ACCEPTED` ➔ `EN_ROUTE` ➔ `ARRIVED` ➔ `IN_PROGRESS` ➔ `COMPLETED` (or `CANCELLED` / `UNFULFILLED`).
- **Atomic Acceptance & Concurrency**: Prisma transactional checks prevent multiple mechanics from double-booking or claiming the same SOS incident.
- **Live Location Broadcasting**: Mechanic GPS streaming via `navigator.geolocation.watchPosition` pushing updates to `/api/emergency/requests/:id/location` and Socket.IO rooms.

### 2. Database & Schema Updates
- Applied Neon Cloud migration `20261121131247_emergency_roadside_assistance`.
- Added Enums: `EmergencyCategory` (8 categories), `EmergencyStatus` (10 stages).
- Added Models: `EmergencyRequest`, `EmergencyAssignmentHistory`, `EmergencyStatusHistory`.
- Extended `Garage` and `MechanicProfile` with `acceptsEmergency`, `latitude`, `longitude`, and `emergencyRadiusKm`.

### 3. Backend Endpoints (`/api/emergency`)
- `GET /api/emergency/nearby`: Discover nearby verified garages and available mechanics.
- `POST /api/emergency/requests`: Customer initiates SOS dispatch with category, location, and vehicle.
- `GET /api/emergency/requests`: Role-tailored emergency requests listing (Customer, Mechanic, Garage, Admin).
- `GET /api/emergency/requests/:id`: Detailed incident record with status and assignment timeline.
- `POST /api/emergency/requests/:id/accept`: Mechanic atomic acceptance.
- `POST /api/emergency/requests/:id/decline`: Mechanic decline with auto-rerouting to next closest provider.
- `PATCH /api/emergency/requests/:id/status`: Transition incident stage (`EN_ROUTE`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`).
- `PATCH /api/emergency/requests/:id/location`: Stream mechanic GPS coordinates and recalculate remaining distance/ETA.
- `POST /api/emergency/requests/:id/reassign`: Administrative manual reassignment override with audit log.
- `POST /api/emergency/requests/:id/cancel`: Customer cancellation with mandatory reason.
- `PATCH /api/emergency/provider/settings`: Provider emergency availability toggle and service radius.

### 4. Frontend Implementation & UI/UX Fixes
- **Emergency Leaflet Map** (`frontend/src/components/emergency/EmergencyMap.tsx`):
  - Dynamic SSR-safe Leaflet map with OpenStreetMap tiles.
  - Pulsing red SOS target pin for customer, animated technician pin with route polyline, and workshop markers.
- **Customer Emergency Portal** (`frontend/src/app/customer/emergency/page.tsx`):
  - Emergency SOS dispatch button, GPS auto-detection, category selector pills, photo attachment.
  - Critical safety advisory banner with immediate `tel:112` government emergency shortcut.
  - Live incident tracker with real-time ETA, technician contact, and Socket.IO updates.
- **Mechanic Roadside Terminal** (`frontend/src/app/mechanic/emergency/page.tsx`):
  - Standby / Active duty toggle, incoming SOS dispatch popups, stage transition buttons.
  - Live GPS broadcasting via `navigator.geolocation.watchPosition`.
- **Garage Emergency Ops** (`frontend/src/app/garage/emergency/page.tsx`):
  - Workshop roadside acceptance toggle, emergency hotline, service radius configuration.
- **Admin Command Center** (`frontend/src/app/admin/emergency/page.tsx`):
  - City-wide incident distribution map, live dispatch table, manual reassignment modal with audit trail.
- **UI/UX Fixes**:
  - Fixed category badge clipping in `frontend/src/app/admin/vehicles/page.tsx` with `min-w-[140px]` and `whitespace-nowrap`.
  - Added navigation links for Roadside SOS in `frontend/src/components/layout/AppLayout.tsx`.
  - Confirmed `/admin/customers` compiles and routes cleanly in production build.

### 5. Automated Verification
- `backend/tests/integration/emergencyAssistance.test.ts`: **8/8 integration tests passing (100%)**.
- `npm run typecheck` (Backend): **0 errors**.
- `npm run typecheck` (Frontend): **0 errors**.
- `next build`: **35/35 routes compiled and statically optimized successfully**.

---

## [Phase 15] Unified Live Location Tracking (Ola/Uber Style) & Platform Intelligence

### 1. Unified Reusable Live Tracking Component (`LiveTrackingMap.tsx` / `EmergencyMap.tsx`)
- **Single Reusable Engine**: Unified mapping component shared seamlessly between Roadside Emergency Assistance and Normal Repair Requests.
- **Interactive Garage Filter Pills**: Filters nearby workshops by `All`, `🚗 Cars`, `🏍️ 2-Wheelers`, and `🚨 Roadside SOS`.
- **Workshop Visibility Toggle**: Show/hide nearby workshop markers on the map with single-click toggle.
- **Recenter Control**: Instant re-centering to incident, mechanic, or workshop coordinates.
- **Rich Interactive Popups**: Popups displaying garage address, star ratings, contact links (`tel:`), hours, and emergency readiness badges.
- **Live ETA & Distance Pill**: Overlay pill displaying real-time technician ETA and remaining distance in km.

### 2. Normal Repair Request Live Tracking
- **Backend Streaming**: Mounted `PATCH /api/requests/:id/location` with authorization guards and automatic remaining distance / ETA calculation.
- **WebSocket Broadcast**: Emits `request:location_updated` to request room and admin channel.
- **Mechanic Journey Sharing** (`/mechanic/jobs/[id]`):
  - "Start Journey & Share GPS" button utilizing `navigator.geolocation.watchPosition`.
  - Real-time GPS broadcasting with active pulse indicator and coordinates display.
  - "Stop Journey" button and automatic cleanup upon unmount or job completion.
- **Customer Live Tracking** (`/customer/requests/[id]`):
  - Prominent "Track Mechanic Live" button with pulsating live indicator.
  - Interactive tracking modal displaying technician details, phone call shortcut, route polyline, and live telemetry.
- **Admin Fleet Monitoring** (`/admin/requests/[id]`):
  - Embedded live route tracking map view displaying assigned technician position, garage, and transit route.

### 3. Admin Command Center Overview Statistics
- **Backend Metrics**: Added `customers.total`, `emergency.total`, `emergency.active`, and `emergency.completed` to `getAdminDashboardStats`.
- **Frontend Dashboard Cards** (`/admin`):
  - Added dedicated Registered Customers card with direct link to `/admin/customers`.
  - Added dedicated Roadside SOS card with active/total/resolved counts and direct link to `/admin/emergency`.

### 4. Verification Suite
- `backend/tests/integration/emergencyAssistance.test.ts`: **8/8 passed (100%)**.
- `backend/tests/integration/reassignmentAndAutomation.test.ts`: **14/14 passed (100%)**.
- Total Integration Tests: **22/22 passed (100%)**.
- `npm run typecheck` (Backend): **0 errors**.
- `npm run typecheck` (Frontend): **0 errors**.
