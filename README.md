# ticketeala_ar
Corporate travel management system with an in-house receipt verification engine for Mutual AMR. Final Project, Information Systems Engineering · UTN FRRo · 2026.

What it does

Employees request trips, approvers authorize them, the travel agency quotes them, and accounting reconciles every expense against a verified receipt.

Travel requests and approvals: requests are validated against expense policies and routed to the right approver by hierarchy, with a substitute when the approver is unavailable.
Quotes: the agency loads options, and the employee or approver picks one.
Expense reports and per diems: employees photograph receipts from the mobile app. Per diems are estimated per night and settled at the end of the trip.
Receipt verification: every receipt goes through the verification engine before it reaches accounting (see below).
Dashboards and audit: management dashboards and an immutable log of approvals, corrections and parameter changes.
The verification engine

The engine is the technical core of the project and is designed by the team. External OCR is just one stage of a five-stage pipeline:

Preprocessing: perspective correction, contrast enhancement (CLAHE) and image quality checks.
Extraction: OCR plus reading of the fiscal QR code (ARCA).
Validation: twelve signals (S01–S12). They check the QR against the OCR, the CAE and its expiry date, tax arithmetic (net + VAT = total), duplicates by fiscal key and by perceptual hash (dHash), the location against the destination (haversine), and statistical outliers (IQR).
Scoring: score = max(0, 100 − Σ penalties). A failed signal subtracts its full weight and a warning subtracts half.
Decision:
Score	Decision
≥ 80 and no blocking signal	Accepted
50–79	Manual review
< 50, or any blocking signal	Alert

Engine parameters are versioned: every verification records the parameter version it used. The engine is evaluated on a labeled set of genuine and tampered receipts, reporting field accuracy (OCR alone vs. engine), detection rate, false positive rate, precision, recall and a confusion matrix.

Architecture
 apps/web (React)      apps/mobile (React Native)
          \                  /
           \                /
            apps/api (NestJS) ── PostgreSQL 17
                 │    │
                 │    └── MinIO (receipt images)
                 │
           Redis Streams (job queue)
                 │
         services/verifier (FastAPI)
The API is a modular monolith. Each module owns its tables.
When a receipt is uploaded, the API stores the image and publishes a job. The verifier consumes it and returns signals, score and decision. The verifier never writes to the database.
Contracts between parts live in docs/contratos/. Changing a contract requires its own PR.
Tech stack
Part	Stack
services/verifier	Python 3.12 · FastAPI · OpenCV · pyzbar · imagehash · pandas · pytest
apps/api	Node.js 22 · TypeScript · NestJS · Prisma · PostgreSQL 17
apps/web	React · TypeScript · Vite
apps/mobile	React Native · Expo · TypeScript
infra/	Docker Compose: PostgreSQL, Redis, MinIO
Repository layout
apps/
  api/             REST API (modular monolith)
  web/             Web panel: accounting, approvers, management, agency, admin
  mobile/          Mobile app: traveling employee and approver
services/
  verifier/        Receipt verification engine
infra/             Local infrastructure (docker-compose)
data/eval/         Engine evaluation set (synthetic data)
docs/              Design docs, data model, decisions, contracts
design/            UI reference screens
Getting started

Setup instructions will be added as each part is scaffolded (see docs/plan-trabajo.md).

Requirements: Node.js 22, Python 3.12, Docker.

bash
git clone https://github.com/<owner>/ticketeala_ar.git
cd ticketeala_ar
cp .env.example .env        # never commit .env
docker compose -f infra/docker-compose.yml up -d
Working with Claude Code

This repo is set up to be developed with Claude Code, locally or at claude.ai/code.

CLAUDE.md holds the project context and rules. Each folder can have its own CLAUDE.md.
PROMPTS.md lists the starting prompts for each role, in order.
docs/decisiones.md lists the team decisions. If it contradicts the source document, the decisions win.
Contributing
One branch per task (feat/uc02-s08-dhash, fix/...). PRs go to main and need a review from another team member.
Code, identifiers and commits are in English. UI text is in Spanish (Rioplatense).
Every business rule and every engine signal has tests. No PR is merged with failing tests.
Before changing code outside your area, tell the team (see ownership in docs/plan-trabajo.md).
Security and data
JWT with refresh tokens, argon2 password hashing, and mandatory TOTP for approvers, accounting and admins.
Role-based authorization on every endpoint.
Receipt images are kept in private storage and served through short-lived signed URLs.
Location is captured only with consent and only when a receipt is taken (Law 25.326).
All test data is synthetic and marked as such. No real Mutual AMR data is stored in this repo.
Out of scope

Ticket issuing (GDS), payments or transfers, in-house machine learning models, and live queries to ARCA.

Team
Name	Role
Felipe Manuel Fernández	Developer
Juan Cruz Bonanno	Developer
Manuel Bautista Coccoz	Developer

Tutor: Mario Bressano · UTN FRRo

License

Academic project. All rights reserved by the authors unless stated otherwise.
