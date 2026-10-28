# ASMS MongoDB database

Database: `scholarship_db`. The existing Prisma models are the source of truth. IDs remain strings so the application's current IDs and API routes stay compatible. MongoDB stores each model's `id` in `_id`.

For the hosted database, configure the Atlas URI in `DATABASE_URL` (see `.env.example`), skip `db:start`, and run `db:setup`. The same schema and indexes apply in Atlas. Set the backend's Render environment variable to that URI; never put database credentials in the frontend. `npm run start:cloud` applies indexes before starting the deployed API. Cloud provisioning and credential changes require access to your Atlas project; the setup files alone do not create an Atlas cluster.

| Collection | Contents | Relationships and indexes |
| --- | --- | --- |
| `users` | Email, password hash, role, refresh token, timestamps | Unique email; role and creation date |
| `profiles` | Name, contact information, institution, department, year, CGPA | Unique user ID gives each user at most one profile |
| `scholarships` | Eligibility criteria, required document types, budget, award amount, capacity, deadline, academic year | Active status and deadline; academic year |
| `applications` | Draft answers, income, academic details, submission date, workflow status | Student and scholarship references; unique student/scholarship pair; indexes for student history, review queues, budget counts and reports |
| `documents` | Document type, filename, storage key/URL, verification status, upload date | Application reference; application/type and pending-document queue indexes |
| `document_reviews` | Reviewer, decision, remarks, review date | Document and user references; indexes for document and reviewer history |
| `workflow_actions` | Actor, workflow stage, action, remarks, timestamp | Application and user references; indexes for application timeline and actor history |
| `notifications` | Recipient ID, title, message, read state, timestamp | Recipient/date and recipient/read-state indexes |
| `audit_logs` | Actor ID, action, entity type/ID, JSON metadata, timestamp | Actor/date and entity/history indexes |
| `stored_files` | Binary upload content, content type, storage key, timestamp | Unique storage key; used by production when Cloudinary is not configured |

The existing application supports STUDENT, VERIFIER, COMMITTEE, ADMIN and SUPER_ADMIN roles. Application statuses cover DRAFT, SUBMITTED, UNDER_VERIFICATION, VERIFICATION_COMPLETE, UNDER_REVIEW, APPROVED, REJECTED, WAITLISTED and DISBURSED. Documents are PENDING, VERIFIED or REJECTED. These remain string fields, with allowed values and transitions handled by the backend. MongoDB does not enforce foreign keys: Prisma manages declared relations, so use the application/Prisma when editing related records. Notification and audit user IDs are scalar references.

Eligibility and academic details use JSON to match the current application. Budgets and income retain the app's existing numeric representation. Uploaded files persist in `stored_files` in production unless Cloudinary is configured. The 5 MB file limit fits within MongoDB's document-size limit, and downloads use expiring signed links. Budget utilization is calculated from approved/disbursed applications and scholarship award amounts.

Run from `backend/`:

```bash
npm run db:start       # Windows: start/reuse the local persistent rs0 server
npm run db:setup       # Generate client, create collections/indexes, check database
npm run prisma:seed    # Optional demo data; preserves existing records
npm run db:check       # Check collections, record counts, indexes and transactions
npm run db:test        # Verify related writes, uniqueness and transaction rollback
```

In MongoDB Compass, connect using:

```text
mongodb://127.0.0.1:27018/scholarship_db?replicaSet=rs0&directConnection=true
```

For another host/Atlas, configure `backend/.env` with a replica-set connection string including the database name. Local native storage is `backend/mongodb-data/`; Docker uses `mongodb_data`. Both are persistent and independent. Older `backend/mongo-data/` files are retained but are not imported into the new database. No existing data was migrated.

Local MongoDB has no authentication and binds to localhost. Hosted databases should use their authenticated connection URI; keep it in `.env` or the hosting provider's environment settings.
