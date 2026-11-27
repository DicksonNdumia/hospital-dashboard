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
| **ADMIN** | Full system access: register staff/lab/patient accounts, manage doctors & schedules, manage campaigns, edit clinic settings (including patient booking confirmation mode), view audit logs, and oversee clinical & lab workflows. |
| **RECEPTIONIST** | Create/edit/archive patients, activate patient portal logins, book/reschedule/cancel appointments, check expected patients into the waiting room, and use internal staff messaging. |
| **DOCTOR** | View appointments, start and complete consultations (`IN_CONSULTATION` → `SEEN`), order laboratory tests, review/approve/release lab reports, update patient notes, and use internal staff messaging. |
| **LAB_TECHNICIAN** | Access the Laboratory Dashboard, manage the lab test catalog, accept/assign lab requests, track specimen collection and processing, enter structured test results, upload private PDF lab reports, and submit orders for doctor review. |
| **PATIENT** | Access the dedicated Patient Self-Service Portal (`Overview`, `Appointments`, `Lab Reports`, `Notifications`, `My Profile`), book/reschedule/cancel appointments with live slot availability, view lab status, download released PDF reports, and manage notification preferences. |

To add Receptionist, Doctor, Lab Technician, or Patient accounts, sign in as an **ADMIN** and navigate to **Settings → Staff accounts & roles**, or allow patients to self-register from the **New patient signup** tab on the Sign-In screen.

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

### 9. Laboratory Management *(Doctor, Lab Technician, Admin)*
- **Ordering:** Doctors or Admins order tests from the **Laboratory** page or directly inside a patient's **Profile Drawer**.
- **Workflow Stages:** Enforces strict server-side transitions: `REQUESTED` → `SAMPLE_COLLECTED` → `PROCESSING` → `COMPLETED` → `UNDER_REVIEW` → `APPROVED` → `RELEASED`.
- **Results & Private PDF Storage:** Lab technicians enter structured parameters and upload PDF reports (max 5 MB, validated `%PDF-` signature, stored privately in `storage/lab-reports/`).
- **Doctor Sign-Off:** Only Doctors or Admins can approve, return for re-test, or release reports to the patient portal (automatically triggering an in-app notification).

### 10. Patient Self-Service Portal *(Patient Role)*
- **Dashboard:** Shows upcoming/recent appointments, pending lab tests, available reports, and unread alerts.
- **Appointment Booking:** Browse clinic services, select a doctor, inspect live open slots, submit bookings (confirmed immediately or pending approval depending on clinic settings), and reschedule or cancel existing visits.
- **Lab Reports:** Track test statuses and securely download released PDF reports (strictly verified for patient ownership and `RELEASED` status).
- **In-App Notifications & Campaigns:** View appointment, lab, and clinic campaign alerts, mark notifications as read, inspect campaign details, and jump directly to appointment booking.

---

## REST API Overview

All protected routes require an `Authorization: Bearer <token>` header.

- **Auth:** `GET /api/auth/status`, `POST /api/auth/setup`, `POST /api/auth/patient-register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/register` (`ADMIN`), `GET /api/auth/users` (`ADMIN`), `PATCH /api/auth/users/:id` (`ADMIN`)
- **Patients:** `GET /api/patients`, `GET /api/patients/:id`, `POST /api/patients`, `PATCH /api/patients/:id`, `DELETE /api/patients/:id`, `POST /api/patients/:id/portal-account`
- **Appointments:** `GET /api/appointments`, `GET /api/appointments/:id`, `POST /api/appointments`, `PATCH /api/appointments/:id`, `DELETE /api/appointments/:id`, `POST /api/appointments/remind-expected`
- **Laboratory:** `GET/POST/PATCH /api/lab/tests`, `GET /api/lab/technicians`, `GET/POST /api/lab/orders`, `PATCH /api/lab/orders/:id/assign`, `POST /api/lab/orders/:id/results`, `POST /api/lab/orders/:id/report`, `POST /api/lab/orders/:id/transition`, `GET /api/lab/reports/:reportId/download`
- **Patient Portal:** `GET /api/portal/overview`, `PATCH /api/portal/profile`, `GET /api/portal/booking-options`, `GET /api/portal/slots`, `POST /api/portal/appointments`, `PATCH /api/portal/appointments/:id`, `POST /api/portal/notifications/:id/read`, `POST /api/portal/notifications/read-all`
- **Patient Flow:** `POST /api/flow/:appointmentId/transition`, `GET /api/flow/patient/:patientId`
- **Doctors:** `GET /api/doctors`, `POST /api/doctors`, `PATCH /api/doctors/:id`, `GET /api/doctors/:id/appointments`
- **Campaigns:** `GET /api/campaigns`, `POST /api/campaigns`, `PATCH /api/campaigns/:id`, `POST /api/campaigns/:id/execute`, `DELETE /api/campaigns/:id`
- **Internal Messaging:** `GET /api/conversations`, `POST /api/conversations`, `POST /api/conversations/:id/messages`, `POST /api/conversations/:id/read`
- **Analytics & Admin:** `GET /api/analytics`, `GET /api/settings`, `PATCH /api/settings`, `GET /api/audit-logs`
