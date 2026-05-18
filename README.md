# License Management System

A professional subscription and license management system built for **1Cloud Technology**. Track software licenses, manage renewals, receive expiry alerts, and generate reports — all from a modern, responsive web interface.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Development Server](#running-the-development-server)
  - [Building for Production](#building-for-production)
- [Database Setup](#database-setup)
  - [Schema Overview](#schema-overview)
  - [Key Tables](#key-tables)
  - [Database Functions and Triggers](#database-functions-and-triggers)
- [Supabase Edge Functions](#supabase-edge-functions)
  - [send-email-notification](#send-email-notification)
  - [daily-reminders](#daily-reminders)
- [Authentication and Authorization](#authentication-and-authorization)
  - [User Roles](#user-roles)
  - [Registration Flow](#registration-flow)
  - [Project-Based Access Control](#project-based-access-control)
- [Application Modules](#application-modules)
  - [Dashboard](#dashboard)
  - [License Manager](#license-manager)
  - [Vendor Manager](#vendor-manager)
  - [Customer Manager](#customer-manager)
  - [Distributor Manager](#distributor-manager)
  - [Project Assign](#project-assign)
  - [Reports and Analytics](#reports-and-analytics)
  - [Notifications](#notifications)
  - [Audit Logs](#audit-logs)
  - [Account Settings](#account-settings)
- [State Management](#state-management)
- [Email Notifications](#email-notifications)
- [Scheduled Jobs](#scheduled-jobs)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **License Lifecycle Management** — Create, update, renew, duplicate, soft-delete, and recover licenses with full serial/contract tracking.
- **Multi-Serial Support** — Each license can have multiple serial/contract entries with individual start/end dates, quantities, unit prices, and currencies (MMK/USD).
- **Automated Expiry Alerts** — Daily scheduled checks identify expiring and expired serials, create in-app notifications, and send email alerts via Brevo.
- **Role-Based Access Control** — Four roles (admin, super_user, user, viewer) with project-based assignment filtering.
- **Real-Time Notifications** — Supabase Realtime subscriptions push new notifications to users instantly.
- **Comprehensive Audit Trail** — Every create, update, and delete action is logged with user identity, IP address, and change diffs.
- **Reports & Analytics** — Visual charts and exportable reports (CSV, XLSX, PDF) for license data, cost trends, and expiry forecasts.
- **Vendor, Customer & Distributor Management** — Centralized directories linked to licenses.
- **File Attachments** — Upload and manage files attached to individual licenses via Supabase Storage.
- **Comments & Mentions** — Collaborate on licenses with threaded comments and user mentions.
- **Bulk Operations** — Bulk update, delete, and export licenses.
- **Soft Delete & Recovery** — Recently deleted licenses can be recovered or permanently purged.
- **Responsive UI** — Collapsible sidebar, animated transitions with Framer Motion, and Tailwind CSS styling.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS 3, Framer Motion |
| **State Management** | Zustand (with persistence) |
| **Routing** | React Router DOM v6 |
| **Backend / Database** | Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions) |
| **Email Service** | Brevo (formerly Sendinblue) via Supabase Edge Function |
| **Charts** | Recharts |
| **Forms** | React Hook Form, React DatePicker, React Select |
| **File Handling** | React Dropzone, XLSX, jsPDF, html2canvas |
| **Notifications UI** | React Hot Toast |
| **Icons** | Lucide React |
| **Deployment** | Vercel |
| **Scheduled Jobs** | GitHub Actions (daily cron) |

---

## Project Structure

```
LicenseAddTesting/
├── .github/
│   └── workflows/
│       └── daily-reminders.yml        # GitHub Actions cron job for daily expiry checks
├── public/
│   └── logo.png                       # 1Cloud Technology logo
├── src/
│   ├── components/
│   │   ├── account/                   # Account settings page
│   │   ├── audit/                     # Audit log viewer
│   │   ├── auth/                      # Login, SignUp, PendingApproval
│   │   ├── common/                    # Shared UI components (Button, Badge, etc.)
│   │   ├── customers/                 # Customer management page
│   │   ├── dashboard/                 # Dashboard with overview cards, charts, calendar
│   │   ├── distributors/              # Distributor management page
│   │   ├── layout/                    # Layout wrapper and Sidebar navigation
│   │   ├── licenses/                  # License CRUD, details, table, form, recently deleted
│   │   ├── notifications/             # Notification center
│   │   ├── projectAssign/             # Project assignment management
│   │   ├── reports/                   # Reports & analytics page
│   │   ├── users/                     # User management (admin only)
│   │   └── vendors/                   # Vendor management page
│   ├── lib/
│   │   ├── supabase.ts                # Supabase client initialization and DB types
│   │   └── emailService.ts            # Frontend email service (calls Edge Function)
│   ├── store/
│   │   ├── authStore.ts               # Authentication state (Zustand + persist)
│   │   ├── licenseStore.ts            # License CRUD, filtering, analytics, import/export
│   │   ├── notificationStore.ts       # Notifications, realtime subscriptions
│   │   ├── auditStore.ts              # Audit log actions and queries
│   │   ├── vendorStore.ts             # Vendor CRUD
│   │   ├── customerStore.ts           # Customer CRUD
│   │   ├── useDistributorStore.ts     # Distributor CRUD
│   │   └── projectAssignStore.ts      # Project assignment CRUD
│   ├── types/
│   │   └── index.ts                   # Shared TypeScript interfaces
│   ├── App.tsx                        # Root component with routing
│   ├── main.tsx                       # Application entry point
│   ├── index.css                      # Global styles (Tailwind directives)
│   └── vite-env.d.ts                  # Vite type declarations
├── supabase/
│   ├── functions/
│   │   ├── daily-reminders/           # Edge Function: daily serial expiry check + email
│   │   └── send-email-notification/   # Edge Function: send email via Brevo API
│   ├── migrations/                    # Database migration files
│   └── config.toml                    # Supabase project configuration
├── .env.example                       # Environment variable template
├── schema.sql                         # Full database schema dump
├── eslint.config.js                   # ESLint configuration
├── tailwind.config.js                 # Tailwind CSS configuration
├── postcss.config.js                  # PostCSS configuration
├── tsconfig.json                      # TypeScript project references
├── tsconfig.app.json                  # TypeScript config for app source
├── tsconfig.node.json                 # TypeScript config for Node/Vite
├── vite.config.ts                     # Vite build configuration
├── vercel.json                        # Vercel deployment (SPA rewrites)
└── package.json                       # Dependencies and scripts
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- A **Supabase** project (free tier works)

### Installation

```bash
# Clone the repository
git clone https://github.com/ayezinhtun/LicenseAddTesting.git
cd LicenseAddTesting

# Install dependencies
npm install
```

### Environment Variables

Copy the example file and fill in your Supabase credentials:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL (e.g., `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous/public API key |
| `VITE_APP_NAME` | Application display name (default: `License Management System`) |
| `VITE_APP_VERSION` | Application version (default: `2.0.0`) |
| `VITE_COMPANY_NAME` | Company name (default: `1Cloud Technology`) |

> **Note:** The email service uses the Supabase Edge Function `send-email-notification`, which requires a `BREVO_API_KEY` secret configured in your Supabase project settings.

### Running the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173` by default.

### Building for Production

```bash
npm run build
```

The production build is output to the `dist/` directory.

### Linting

```bash
npm run lint
```

---

## Database Setup

The application uses **Supabase (PostgreSQL)** as its backend. The complete schema is available in [`schema.sql`](./schema.sql).

### Schema Overview

The database uses several custom enum types:

| Enum | Values |
|------|--------|
| `audit_action` | `create`, `update`, `delete`, `view`, `export`, `login`, `logout` |
| `entity_type` | `license`, `user`, `report`, `notification`, `notifications`, `license_comments`, `license_attachments`, `user_profiles`, `license_serials`, `license_customers`, `license_distributors`, `user_project_assigns`, `licenses`, `vendors`, `project_assigns`, `customers`, `distributors`, `renewal_history` |
| `license_status` | `active`, `expired`, `suspended`, `pending`, `in_progress`, `completed` |
| `notification_priority` | `low`, `medium`, `high` |
| `notification_type` | `expiry`, `renewal`, `comment`, `system`, `warning`, `info` |
| `priority_level` | `low`, `medium`, `high`, `critical` |
| `user_role` | `user`, `admin`, `manager`, `super_user` |
| `user_status` | `pending`, `approved`, `rejected` |

### Key Tables

| Table | Purpose |
|-------|---------|
| `licenses` | Core license records with vendor, project, status, priority, and soft-delete support |
| `license_serials` | Serial/contract entries per license (start/end dates, qty, price, currency, renewal flag) |
| `license_customers` | Customer associations per license |
| `license_distributors` | Distributor associations per license |
| `license_comments` | Threaded comments on licenses with mention support |
| `license_attachments` | File attachments linked to licenses |
| `vendors` | Vendor directory |
| `customers` | Customer directory |
| `distributors` | Distributor directory |
| `project_assigns` | Project assignment options |
| `user_profiles` | Extended user profiles (role, status, full name) |
| `user_project_assigns` | Maps users to their assigned projects |
| `notifications` | In-app notification records |
| `notification_reads` | Per-user read tracking for notifications |
| `notification_deletions` | Per-user deletion tracking for notifications |
| `renewal_history` | Historical record of license renewals with old/new snapshots |
| `audit_logs` | Comprehensive audit trail of all system actions |

### Database Functions and Triggers

| Function | Purpose |
|----------|---------|
| `audit_log_row()` | Trigger function that automatically logs INSERT, UPDATE, and DELETE operations to `audit_logs` with change diffs |
| `handle_new_user()` | Trigger on `auth.users` that auto-creates a `user_profiles` row with `pending` status |
| `set_updated_at()` / `update_updated_at_column()` | Trigger functions to auto-update `updated_at` timestamps |
| `cleanup_notification_reads()` | Cleans up read records when notifications are deleted |
| `jsonb_changes()` | Computes a diff between old and new JSONB rows for audit logging |
| `current_request_user()` / `current_request_client()` | Extract user and client info from JWT claims and request headers |

---

## Supabase Edge Functions

### send-email-notification

**Path:** `supabase/functions/send-email-notification/index.ts`

Sends transactional emails via the [Brevo](https://www.brevo.com/) SMTP API.

- **Endpoint:** `POST /functions/v1/send-email-notification`
- **Payload:** `{ to: string, subject: string, html: string }`
- **Requires:** `BREVO_API_KEY` environment secret in Supabase

### daily-reminders

**Path:** `supabase/functions/daily-reminders/index.ts`

Runs daily to check for expiring/expired license serials and sends notifications.

- **Endpoint:** `POST /functions/v1/daily-reminders`
- **Logic:**
  1. Queries all `license_serials` with joined license data
  2. Identifies expired serials (end_date < today)
  3. Identifies expiring-soon serials based on each serial's `notify_before_days` setting (default: 30 days)
  4. For each serial, finds assigned project users and all admin users
  5. De-duplicates to avoid sending the same notification twice in one day
  6. Creates per-user in-app notifications
  7. Sends email alerts to each recipient via `send-email-notification`

---

## Authentication and Authorization

Authentication is handled by **Supabase Auth** with email/password sign-up and sign-in.

### User Roles

| Role | Permissions |
|------|-------------|
| **admin** | Full access to all features, all licenses across all projects, user management, vendor/customer/distributor/project management |
| **super_user** | Access to licenses within assigned projects, notifications for assigned projects |
| **user** | Access to licenses within assigned projects, personal notifications |
| **viewer** | Read-only access (role defined in schema, limited UI access) |

### Registration Flow

1. User signs up via the `/signup` page
2. A `user_profiles` row is automatically created with `status = 'pending'` (via the `handle_new_user` database trigger)
3. The user is redirected to `/pending-approval` and cannot access the main application
4. An admin must approve the user by changing their status to `approved` in the User Management page
5. Once approved, the user can log in and access the application based on their assigned role

### Project-Based Access Control

- Admins see all licenses regardless of project assignment
- Super users and regular users only see licenses belonging to their assigned projects
- Project assignments are managed through the `user_project_assigns` table
- Notifications for license expiry are also scoped to project assignments

---

## Application Modules

### Dashboard

**Path:** `/dashboard`

The main landing page after login, featuring:
- **Overview Cards** — Total licenses, active, expired, near-expiry counts, and cost summaries
- **Chart Widget** — Visual analytics for license data trends
- **Calendar Widget** — Upcoming expiry dates
- **Recent Activity** — Latest audit log entries
- **Notifications List** — Unread notification summary
- **Quick Actions** — Shortcuts for common tasks

### License Manager

**Path:** `/licenses`

Core module for license lifecycle management:
- **License Table** — Paginated, sortable, filterable list with search
- **License Form** — Multi-section form with serial entries, customer/distributor associations
- **License Details** — Full view with comments, attachments, renewal history, and related data
- **Filters** — By vendor, project, status, priority, date range, serial number, and project assignment
- **Bulk Operations** — Select multiple licenses for bulk update or delete
- **Export** — CSV, XLSX, and PDF export support
- **Import** — XLSX file import for bulk license creation
- **Recently Deleted** (`/licenses/deleted`) — View and recover soft-deleted licenses (admin only)

### Vendor Manager

**Path:** `/vendors` (admin only)

CRUD management for software vendors. Vendors are linked to licenses and used for filtering.

### Customer Manager

**Path:** `/customers` (admin only)

Manage customer companies with contact details (person, email, phone, address). Customers can be linked to individual licenses.

### Distributor Manager

**Path:** `/distributors` (admin only)

Manage distributor companies with contact details. Distributors can be linked to individual licenses.

### Project Assign

**Path:** `/project-assign` (admin only)

Manage project assignment options (e.g., NPT, YGN, MPT). These are used to scope user access to specific licenses.

### Reports and Analytics

**Path:** `/reports`

Generate and export reports with:
- License summary by vendor, project, or status
- Cost trend analysis over time
- Expiry forecasts and renewal tracking
- Export in CSV, XLSX, and PDF formats

### Notifications

**Path:** `/notifications`

Notification center with:
- Filterable list by type (expiry, renewal, comment, system, warning, info)
- Mark as read (individual or all)
- Delete notifications (per-user soft delete)
- Real-time updates via Supabase Realtime subscriptions
- Email notification forwarding (configurable)

### Audit Logs

**Path:** `/audit`

Comprehensive activity log showing:
- All create, update, delete, view, and export actions
- User identity, timestamps, IP addresses, and user agents
- Change diffs showing old and new values
- Filterable by action type, entity type, user, and date range
- Time period presets (recent, week, month, year)
- CSV export
- Admin: all logs visible; non-admin: only own logs

### Account Settings

**Path:** `/account`

- Update display name
- Change password (requires current password verification)
- View profile information

---

## State Management

The application uses [Zustand](https://github.com/pmndrs/zustand) for state management with the following stores:

| Store | File | Purpose |
|-------|------|---------|
| `useAuthStore` | `store/authStore.ts` | Authentication state, user profile, project assignments. Uses `persist` middleware for session persistence. |
| `useLicenseStore` | `store/licenseStore.ts` | License CRUD, filtering, sorting, pagination, serial/customer/distributor management, renewals, comments, attachments, analytics, import/export. |
| `useNotificationStore` | `store/notificationStore.ts` | Notification CRUD, realtime subscriptions, read/delete tracking, email forwarding. |
| `useAuditStore` | `store/auditStore.ts` | Audit log queries, filtering, analytics, action logging with de-duplication. |
| `useVendorStore` | `store/vendorStore.ts` | Vendor CRUD operations. |
| `useCustomerStore` | `store/customerStore.ts` | Customer CRUD operations. |
| `useDistributorStore` | `store/useDistributorStore.ts` | Distributor CRUD operations. |
| `useProjectAssignStore` | `store/projectAssignStore.ts` | Project assignment CRUD operations. |

---

## Email Notifications

The system supports email notifications through a two-layer architecture:

1. **Frontend Email Service** (`src/lib/emailService.ts`) — A singleton class used by the frontend to send emails for license expiry alerts, renewal confirmations, and comment notifications. It calls the Supabase Edge Function via HTTP.

2. **Supabase Edge Function** (`supabase/functions/send-email-notification/`) — The backend function that interfaces with the Brevo SMTP API to deliver emails. Requires a `BREVO_API_KEY` secret.

Email types include:
- **License Expiry Alerts** — Urgency-coded emails (URGENT / IMPORTANT / NOTICE) with license details and action links
- **Renewal Confirmations** — Success emails with renewal details and updated dates
- **Comment Notifications** — Alerts when new comments are posted on licenses

---

## Scheduled Jobs

### Daily Expiry Reminder

**File:** `.github/workflows/daily-reminders.yml`

A GitHub Actions workflow that runs daily at **18:30 UTC** (midnight MMT) to trigger the `daily-reminders` Supabase Edge Function.

**Required GitHub Actions Secrets:**

| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous API key |

**Setup:**
1. Go to your GitHub repository **Settings > Secrets and variables > Actions**
2. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as repository secrets
3. The workflow can also be triggered manually from **Actions > Daily Expiry Reminder > Run workflow**

---

## Deployment

The application is configured for deployment on **Vercel**.

- The `vercel.json` file configures SPA rewrites so all routes serve `index.html`
- Build command: `npm run build` (outputs to `dist/`)
- Framework: Vite

**Steps:**
1. Connect your GitHub repository to Vercel
2. Set the environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in your Vercel project settings
3. Deploy — Vercel will automatically build and deploy on pushes to the main branch

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

This project is private and proprietary to **1Cloud Technology**.
