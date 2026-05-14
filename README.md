# AI-Based Emergency Room Triage & Management System

Production-grade full-stack ER triage and management system aligned to [PRD.md](/D:/codex%20triage/PRD.md) and [Design.md](/D:/codex%20triage/Design.md).

## Overview

This monorepo contains:

- `frontend`: Next.js App Router dashboard
- `backend`: Express + TypeScript API
- `shared`: shared enums and type contracts

Implemented core workflows:

- JWT auth with doctor, nurse, and viewer roles
- patient intake preview with duplicate detection
- LLM symptom interpretation review before save
- quick entry for immediate emergency intake
- rule-based triage with explainability
- doctor override with scope and auto-clear rules
- queue sorting and viewer-safe queue scoping
- demo patient generation
- simulation engine for demo patients
- bed allocation and configuration
- immutable audit logging
- nurse management
- reset flow with typed confirmation and forced logout

## Tech Stack

- Frontend: Next.js, TypeScript, Tailwind CSS, Zustand, Recharts, Lucide
- Backend: Node.js, Express, TypeScript, MongoDB, Mongoose, JWT, bcrypt
- AI: Groq via OpenAI-compatible SDK

## Setup

### Prerequisites

- Node.js 20+
- npm 10+
- MongoDB

### Install

```bash
npm install
```

### Environment

Create a root `.env` from `.env.example`.

Required backend variables:

- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- one of `XAI_API_KEY` or `GROQ_API_KEY`

Common runtime variables:

- `JWT_EXPIRES_IN`
- `XAI_BASE_URL`
- `XAI_MODEL`
- `GROQ_BASE_URL`
- `GROQ_MODEL`
- `AI_REQUEST_TIMEOUT_SECONDS`
- `AI_MAX_TOKENS`
- `DEFAULT_GENERAL_BEDS`
- `DEFAULT_CRITICAL_BEDS`
- `SIMULATION_ENABLED`
- `SIMULATION_TICK_SECONDS`
- `SEED_ENABLED`
- `NEXT_PUBLIC_API_BASE_URL`

### Run

```bash
npm run dev:backend
npm run dev:frontend
```

### Run The Full System

Use the root launcher to start backend and frontend together from any checkout location:

```bash
npm run dev
```

This script is repo-relative and does not depend on any user-specific parent folder path. It works as long as the repository structure itself is preserved.

For Windows users who want a one-click launcher from the repository root, use either:

```powershell
.\run-system.ps1
```

or:

```bat
run-system.cmd
```

Both launchers resolve the repository root dynamically from their own file location, so they remain portable when the project is cloned into a different parent folder.
They are now first-time setup friendly:

- auto-create `.env` from `.env.example` when missing
- auto-run `npm install` when `node_modules` is not present
- keep the terminal open with actionable error hints if startup fails (instead of closing immediately)

For a production-style combined start after building:

```bash
npm run build
npm run start
```

## Default Credentials

- Doctor: `doctor@er.com` / `Doctor@123`
- Nurse: `nurse@er.com` / `Nurse@123`

No default viewer is seeded automatically.

## Seed Script

```bash
npm run seed --workspace backend
```

The seed is idempotent and only creates missing default doctor and nurse accounts.

## Auth Flow

- `POST /api/auth/login`: returns JWT and `{ id, email, role }`
- `GET /api/auth/me`: validates the active session
- manual logout clears the persisted session immediately and returns the user to `/login`
- auth session hydration now self-recovers by clearing corrupted saved auth storage if an old invalid browser session blob is encountered
- sessions expire after 8 hours of inactivity
- any `401` on the frontend clears auth state and redirects to `/login`
- reset invalidates active sessions and shows `System has been reset by administrator`
- dashboard alerts now live inside the topbar notification center with unread-dot tracking

## Patient Workflows

### Full Intake

1. enter demographic, symptom, vitals, injury, and history data
2. backend checks for duplicate active patients by name + age + gender
3. if free-text exists, LLM preview returns normalized symptoms, risk flags, confidence, and summary
4. clinician confirms or edits normalized symptoms
5. backend creates patient, runs triage, assigns bed, stores vitals history, and appends audit events

### Duplicate Detection

- duplicate check is performed before save
- the UI shows `Possible duplicate patient detected`
- clinician must explicitly continue to persist the patient

### Quick Entry

- minimal emergency intake for fast admission
- hard critical flags are checked immediately
- hard critical quick-entry cases are inserted into the queue as `Critical`
- quick-entry patients are marked `awaitingFullData` until a later clinical update completes the record

### Patient Updates

Doctor and nurse workflows include:

- clinical updates
- vitals updates
- note updates
- status changes
- referred flow with required destination and reason
- manual review clearance
- optimistic locking via `version`

Doctor-only workflow:

- delete an individual patient record from the details panel without using full system reset

If the submitted version is stale, the backend returns:

`Record was updated by another source. Please refresh and retry.`

## Triage Engine

The rule engine remains the final priority authority.

Decision order:

1. hard critical flags
2. doctor override
3. AI escalation
4. weighted score
5. time escalation
6. priority lock on downgrade

Weights:

- vitals: 40
- symptoms: 30
- history: 10
- AI confidence: 20

Fallback weights when AI is unavailable:

- vitals: 50
- symptoms: 37.5
- history: 12.5

Explainability output includes:

- `top_factor`
- `contributors`

Manual review rule:

- waiting time adds `+2` every `5` minutes
- cap is `+20`
- capped normal patients below urgent threshold are flagged `Awaiting Manual Review`

### PRD Ambiguity Resolution

The PRD contains an internal conflict around AI escalation to `Critical`. The implementation keeps the safer behavior:

- AI can escalate to at least `Urgent`
- AI does not directly make the final decision on `Critical`
- hard critical rules and doctor override remain authoritative

The severe bleeding rule also follows the safer interpretation by escalating from direct clinical input rather than waiting for an AI-derived bleeding flag.

## AI Layer

The LLM service lives in [llm.service.ts](/D:/codex%20triage/backend/src/services/llm.service.ts).

Behavior:

- provider auto-detection for xAI or Groq via OpenAI-compatible client
- Groq is selected automatically when `GROQ_API_KEY` is set, or when `XAI_API_KEY` starts with `gsk_`
- JSON-only responses
- schema validation of risk flags, confidence, summary, and normalized symptoms
- statuses: `success`, `fallback`, `failed`
- fallback summary: `AI analysis unavailable. Score based on rule engine only.`
- doctor/nurse-only patient AI guide with five fixed guided prompts:
  - predicted problem
  - care priorities
  - do's and don'ts
  - monitoring focus
  - handoff summary
- patient guide responses are generated from the current patient JSON context, not from free-text chat input

## Beds and Simulation

### Bed Management

- general beds
- critical beds
- doctor-only bed count changes
- bed configuration sliders reflect the currently saved totals and stay aligned with persisted system settings after restart
- bed sliders use higher-contrast tracks and colored thumbs so the selected range is visible against the glass background
- safe reduction guard when occupied beds exceed requested target
- critical patients prefer critical beds first
- overflow may use a general bed with `priorityMismatch`
- higher-acuity patients can reclaim beds from lower-priority patients when capacity is exhausted
- displaced patients are marked as `Reassigned` or `Transferring` so bed pressure is visible on the dashboard
- completed, discharged, and referred patients release bed assignments

### Simulation

- runs only for demo patients
- uses `simulation` data-source tags
- manual patients are never auto-modified
- simulation tick re-runs triage and appends vitals history
- critical demo patients now fluctuate within dangerous but varied ranges so the vitals trends stay clinically unstable instead of collapsing into identical flat lines

## Audit Logging

Audit logs are append-only and available to doctors.

Tracked events include:

- patient created
- patient deleted
- vitals updated
- priority changed
- doctor override applied / cleared
- bed assignment changes
- patient status changes
- LLM symptom correction
- system reset
- nurse created / removed

Reset no longer deletes audit logs.

## Dashboard

Role-aware dashboard sections:

- Dashboard
- Patients
- Beds
- Analytics
- Audit Logs
- Settings

Implemented dashboard features:

- compact intake launcher: a single Add / Admit Patient button expands the full intake tools only when needed
- refreshed glass-surface visual treatment with frosted panels, softer shadows, and modernized controls while preserving the dashboard layout
- bed tiles, hover previews, summary boxes, and detail sections now use stronger glassmorphism surfaces instead of flat opaque white panels
- notification center now renders above the dashboard stack, bed tiles use clearer critical/general color separation, and flat vitals traces show as stable snapshots rather than unreadable straight-line charts
- system summary sits near the top of the dashboard for immediate visibility
- system summary now refreshes immediately after patient create, demo generation, update, override, status change, and delete actions
- clinical updates now auto-retry once on optimistic-lock conflicts by refreshing the latest patient version first, which keeps remarks, vitals, and note updates usable even while demo/simulated records are changing in the background
- center queue: compact grid with switchable sorting by priority, waiting time, score, bed assignment, or name
- right panel: AI summary, risk flags, vitals graph, notes, override tools, audit preview, beds, and activity feed
- patient-specific AI guide popup for doctor and nurse roles with fixed one-click clinical guidance prompts
- the patient AI guide opens through a top-level centered portal overlay instead of rendering inside the dashboard column layout
- alerts strip
- system summary cards
- activity feed
- bed status panel
- doctor-only analytics
- doctor-only audit logs
- doctor-only settings for nurse management and reset

Viewer restrictions:

- viewer only sees patient ID, priority, status, and wait time in the queue
- viewer cannot access patient details, analytics, audit logs, notes, AI summaries, risk flags, or bed management

Queue card behavior:

- compact cards stay fixed in size and act as queue selectors
- cards show only the most important status badges and top risk chips
- full patient detail stays in the right-side detail panel instead of expanding inside the grid
- bed labels use abbreviated tiles such as `CRT` and `GEN` to reduce dashboard clutter
- assigned beds are highlighted directly on queue cards and inside the bed grid with patient ID and name
- bed hover opens a floating patient-info card instead of resizing neighboring tiles

Analytics now includes:

- summary metric cards
- top critical patient score chart with patient IDs on the axis
- wait-time versus score comparison by patient ID
- live priority mix chart

Bed/status behavior:

- a patient who receives a bed assignment is automatically moved from `Waiting` to `In Treatment`
- dashboard alerts are shown in the notification dropdown instead of stacking inline across the page

## Reset Flow

`POST /api/system/reset` requires doctor auth and typed confirmation:

```json
{
  "confirmationText": "RESET",
  "reseedDemoCount": 0
}
```

Reset behavior:

- deletes patient data
- clears queue/simulation state by removing active patients
- resets bed config to defaults
- preserves default doctor and default nurse
- invalidates active sessions
- keeps immutable audit history
- reset UI clearly separates typed `RESET` confirmation from optional demo reseed count

## Key API Routes

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`

### Patients

- `GET /api/patients`
- `GET /api/patients/:patientId`
- `POST /api/patients/:patientId/guidance`
- `POST /api/patients/intake/preview`
- `POST /api/patients`
- `POST /api/patients/quick-entry`
- `POST /api/patients/demo`
- `PATCH /api/patients/:patientId`
- `PATCH /api/patients/:patientId/status`
- `PATCH /api/patients/:patientId/override`
- `DELETE /api/patients/:patientId`
- `DELETE /api/patients/:patientId/override`
- `GET /api/patients/analytics`

### System

- `GET /api/system/overview`
- `PUT /api/system/beds`
- `POST /api/system/reset`

### Admin / Audit

- `GET /api/audit-logs`
- `GET /api/users/nurses`
- `POST /api/users/nurses`
- `DELETE /api/users/nurses/:nurseId`

## Verification

Verified locally with:

```bash
npx tsc -p backend/tsconfig.json --noEmit
npm run build --workspace backend
npm run build --workspace frontend
npm run dev
npm run test:auth-smoke --workspace backend
npm run test:demo-smoke --workspace backend
npm run test:triage-smoke --workspace backend
npm run test:workflow-smoke --workspace backend
```

The backend was also started successfully against the local `.env` and logged:

- `MongoDB connected successfully`
- `Backend listening on http://localhost:5000`
