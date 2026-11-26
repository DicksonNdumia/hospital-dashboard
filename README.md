# Northfield Family Clinic — Healthcare Operations Dashboard

A full-stack healthcare clinic management platform for **Northfield Family Clinic**, built with React, TypeScript, Tailwind CSS, Express, and Prisma ORM (SQLite).

It supports role-based clinic authentication, patient records, conflict-checked appointment scheduling, a live four-stage patient visit workflow, doctor schedule management, internal staff messaging, database-backed campaigns, clinic analytics, and audit logging.

---

## Tech Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, Lucide Icons, Recharts
- **Backend:** Express (`server.ts`), Zod validation, Node `crypto.scrypt` password hashing, DB-backed Bearer sessions
- **Database:** SQLite (`prisma/clinic.db`) with Prisma ORM (`prisma/schema.prisma`)

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration (Optional)

Copy `.env.example` if you want to customize local environment variables:

```env
DATABASE_URL="file:./clinic.db"
```

> By default, the server automatically resolves `prisma/clinic.db` and creates/seeds the database tables if needed. Optionally, you may set `ADMIN_BOOTSTRAP_PASSWORD` in your environment before first startup to auto-provision the default administrator login.

### 3. Database Migration & Seed

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

### 4. Run the App

**Development (Express API + Vite middleware on port 3000):**

```bash
npm run dev
```

**Production build & server:**

```bash
npm run build
NODE_ENV=production npm start
```

**Typecheck:**

```bash
npm run lint
```

Open `http://localhost:3000` in your browser.

---

## Authentication & User Roles

### Default Administrator Sign-In

The default Clinic Administrator profile is configured as:

- **Name:** `Dickson Ndumia`
- **Email:** `dicksonndumia19@gmail.com`
- **Role:** `ADMIN`

On a brand-new database without an existing admin account, the app opens the **Initial Administrator Setup** screen pre-filled with **Dickson Ndumia** (`dicksonndumia19@gmail.com`) so you can choose your password and claim administrator access. Once created, subsequent visits display the standard **Sign In** screen.

### Role-Based Access Control (Enforced on Server & UI)

| Role | Capabilities |
| :--- | :--- |
| **ADMIN** | Full system access: register staff accounts, manage doctors & schedules, manage campaigns, edit clinic settings, view audit logs, and manage all clinical workflows. |
| **RECEPTIONIST** | Create/edit/archive patients, book/reschedule/cancel appointments, check expected patients into the waiting room, and use internal staff messaging. |
| **DOCTOR** | View appointments, start and complete consultations (`IN_CONSULTATION` → `SEEN`), record diagnosis/clinical notes, update patient notes, and use internal staff messaging. |

To add Receptionist or Doctor accounts, sign in as an **ADMIN**, navigate to **Settings → Staff Accounts**, and register new staff members.

---

## How to Use the App

### 1. Dashboard (Daily Overview & Patient Flow)
- **KPI Summary Cards:** View today's scheduled/completed appointments, patients waiting, unread internal messages, and today's no-show rate.
- **Quick Actions:** Use **New Appointment** to schedule a visit or **Remind All** to send reminder notifications for expected appointments today.
- **Patient Flow Board:** Tracks every visit across four enforced stages:
  1. **Expected** → Receptionist or Admin clicks **Check In** to move the patient to the waiting room.
  2. **Waiting Room** → Doctor or Admin clicks **Start Consultation** (automatically calculates waiting time in minutes).
  3. **In Consultation** → Doctor or Admin clicks **Mark as Seen**, enters chief complaint, clinical notes, diagnosis, and follow-up plan, and saves the consultation record.
  4. **Seen** → Completed visits update appointment status to `COMPLETED` and appear in the patient's visit history.

### 2. Inbox (Internal Clinic Messaging)
- Select a thread in the left conversation list or click **New Conversation** to coordinate between reception and doctors.
- Send messages and attach chart/form references in the center panel; unread counts automatically clear when a thread is opened.
- Inspect linked patient context in the right-hand panel.
- *Note: Messaging is strictly internal and persisted in the clinic database (no external SMS/WhatsApp/email providers).*

### 3. Patients
- Search patients by **name, email, or phone**, or filter by **status** (`Active`, `New`, `Follow-up`, `Archived`) and **assigned doctor**.
- Click **New Patient** to register a record, or click any row to open the **Patient Profile Drawer** showing demographics, insurance details, clinical notes, and full visit/consultation history.
- Use **Archive** to soft-archive a patient without permanently deleting historical visit records.

### 4. Appointments
- Filter appointments by status (`SCHEDULED`, `CONFIRMED`, `CANCELLED`, `COMPLETED`, `NO_SHOW`), doctor, or date.
- Create or reschedule appointments with automatic server-side enforcement:
  - Prevents overlapping bookings for the same **doctor**.
  - Prevents overlapping active bookings for the same **patient**.
  - Validates against the selected **doctor's working hours and active schedule days**.
  - Cancelling an appointment frees up the time slot immediately.

### 5. Schedule (Doctor Availability & Hours)
- View each doctor's daily status, specialty, suite/room, and capacity.
- Admins can toggle **Available Today** and edit weekly working days and start/end hours (`Monday–Saturday`).

### 6. Campaigns *(Admin Only)*
- Create, edit, schedule, execute, or cancel patient communication campaigns (`DRAFT`, `SCHEDULED`, `COMPLETED`, `CANCELLED`).
- Define target audiences, message templates, recipient counts, and scheduled dates, and track campaign engagement metrics stored in the database.

### 7. Reports
- Review clinic performance metrics computed directly from database records:
  - Weekly appointment volume trends (`Scheduled`, `Completed`, `No-Show`).
  - Doctor workload and daily capacity utilization.
  - Average patient waiting times and no-show percentages.

### 8. Settings
- **Clinic Profile & Preferences:** Update clinic name, address, contact info, opening hours, default appointment duration, and reminder rules.
- **Staff & Doctors (Admin Only):** Register new staff accounts (`ADMIN`, `RECEPTIONIST`, `DOCTOR`), activate/deactivate accounts, and register new doctors.
- **Audit Log (Admin Only):** Inspect timestamped records of authentication, patient updates, appointment bookings, flow transitions, and configuration changes.

---

## REST API Overview

All protected routes require an `Authorization: Bearer <token>` header.

- **Auth:** `GET /api/auth/status`, `POST /api/auth/setup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/register` (`ADMIN`), `GET /api/auth/users` (`ADMIN`), `PATCH /api/auth/users/:id` (`ADMIN`)
- **Patients:** `GET /api/patients`, `GET /api/patients/:id`, `POST /api/patients`, `PATCH /api/patients/:id`, `DELETE /api/patients/:id` (soft archive)
- **Appointments:** `GET /api/appointments`, `GET /api/appointments/:id`, `POST /api/appointments`, `PATCH /api/appointments/:id`, `DELETE /api/appointments/:id`, `POST /api/appointments/remind-expected`
- **Patient Flow:** `POST /api/flow/:appointmentId/transition`, `GET /api/flow/patient/:patientId`
- **Doctors:** `GET /api/doctors`, `POST /api/doctors`, `PATCH /api/doctors/:id`, `GET /api/doctors/:id/appointments`
- **Campaigns:** `GET /api/campaigns`, `POST /api/campaigns`, `PATCH /api/campaigns/:id`, `POST /api/campaigns/:id/execute`, `DELETE /api/campaigns/:id`
- **Internal Messaging:** `GET /api/conversations`, `POST /api/conversations`, `POST /api/conversations/:id/messages`, `POST /api/conversations/:id/read`
- **Analytics & Admin:** `GET /api/analytics`, `GET /api/settings`, `PATCH /api/settings`, `GET /api/audit-logs`
