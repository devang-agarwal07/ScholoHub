# 🎓 ScholoHub — Adaptive Scholarship Management System

A full-stack scholarship management platform designed to simplify and digitize the complete scholarship application process. The system manages scholarship discovery, applications, document verification, evaluation, approval, and reporting through a role-based workflow.

**Cloud deployment:** follow [DEPLOYMENT.md](DEPLOYMENT.md) to create the MongoDB Atlas database, deploy the backend and frontend on Render, and connect them. Repository: [devang-agarwal07/ScholoHub](https://github.com/devang-agarwal07/ScholoHub).

## ✨ Features

### 👨‍🎓 Student
- Browse and search available scholarships
- Multi-step scholarship application
- Auto-save application progress
- Upload required documents
- Track application status
- View application history

### 🔍 Verifier
- View pending document verification requests
- Review uploaded documents
- Verify or reject documents
- Add remarks and feedback
- Automatically progress applications after verification

### 👥 Committee Member
- Review verified applications
- View student information and personal statements
- Approve, reject, or waitlist applications
- Track application workflow history

### 🛡️ Administrator
- Dashboard with KPIs and analytics
- Create, update, and manage scholarships
- Manage users and roles
- Track scholarship budgets and utilization
- Generate reports
- Export reports in CSV/PDF format

## 🏗️ Architecture

```text
Scholarship Management System
│
├── Frontend
│   └── React + TypeScript + Vite + Tailwind CSS
│
├── Backend
│   └── Node.js + Express + TypeScript
│
├── Database
│   └── MongoDB replica set + Prisma ORM
│
├── Cache & Background Jobs
│   └── Redis + BullMQ
│
└── File Storage
    └── AWS S3 / MinIO
```

## 🔄 Application Workflow

```text
Student
   │
   ▼
Browse Scholarships
   │
   ▼
Create Application
   │
   ▼
Upload Documents
   │
   ▼
Document Verification
   │
   ├── Rejected ──► Resubmit Documents
   │
   └── Verified
          │
          ▼
    Committee Review
          │
     ┌────┼────────┐
     ▼    ▼        ▼
  Approve Reject  Waitlist
     │
     ▼
Scholarship Award
```

## 🔐 Role-Based Access Control

The system provides different permissions for each user role:

| Role | Responsibilities |
|---|---|
| Student | Apply for scholarships and track applications |
| Verifier | Review and verify submitted documents |
| Committee Member | Evaluate and make decisions on applications |
| Admin | Manage users, scholarships, reports, and budgets |

Authentication uses **JWT-based access and refresh tokens**.

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| UI | shadcn/ui |
| State Management | Zustand |
| Server State | TanStack Query |
| Charts | Recharts |
| Backend | Node.js, Express, TypeScript |
| ORM | Prisma |
| Database | MongoDB |
| Cache | Redis |
| Background Jobs | BullMQ |
| Storage | AWS S3 / MinIO |
| Authentication | JWT |
| Validation | Zod |
| Containerization | Docker |

## 📁 Project Structure

```text
scholarship-system/
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed/
│   │
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── utils/
│   │   ├── jobs/
│   │   ├── modules/
│   │   └── app.ts
│   │
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── store/
│   │   ├── hooks/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.tsx
│   │
│   └── Dockerfile
│
├── docker-compose.yml
├── render.yaml
└── .github/
    └── workflows/
```

## 🚀 Getting Started

### Hosted database (MongoDB Atlas)

Use MongoDB Atlas for the cloud database. Hosting the database does not require moving the frontend or backend to another provider.

1. Create/select an Atlas cluster and a database user with `readWrite` access to `scholarship_db`.
2. Add the app server's outbound IP addresses to Atlas Network Access. Add your computer's IP as well if running the app or setup commands locally.
3. Put the Atlas driver URI in `backend/.env` as `DATABASE_URL`, including `/scholarship_db` before the query string. Use the format in `.env.example`; URL-encode special characters in the database password. Keep this URI out of source control and frontend environment variables.
4. From `backend/`, run `npm run db:setup` to create the nine collections and indexes in Atlas. The demo seed is optional and disabled in production.
5. Set the same Atlas URI as the backend's `DATABASE_URL` in Render. Use `npm run start:cloud` as the start command so indexes are synchronized before the server starts. Existing data is retained; conflicting unique indexes cause deployment to stop instead of resetting the database.
6. Verify the cloud connection using `npm run db:check`, then check login, applications and reports through the deployed app.

`render.yaml` defines a `scholohub` web service that serves the React frontend and API on one HTTPS origin. Supply the Atlas URI as a backend secret. See [DEPLOYMENT.md](DEPLOYMENT.md) for the exact commands and settings, including the option to host the frontend separately. A separate Vercel deployment is optional.

The upload helper uses Cloudinary when `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are configured. Configure persistent cloud file storage for hosted document uploads; MongoDB stores metadata, not the uploaded files.

### Prerequisites

Make sure you have the following installed:

- Node.js 20+
- MongoDB Community Server and MongoDB Shell (`mongosh` on PATH), or Docker
- Redis 7+
- npm
- Git

### Backend Setup

```bash
cd backend

npm install

# Configure backend/.env using .env.example first.
# Windows: start the persistent local MongoDB replica set.
npm run db:start

# Create the collections and indexes, and verify the connection.
npm run db:setup

# Optional: add demo users, scholarships and a draft application.
npm run prisma:seed
```

Create and configure your `.env` file with the required database, Redis, authentication, and storage variables.

The local connection is `mongodb://127.0.0.1:27018/scholarship_db?replicaSet=rs0&directConnection=true&serverSelectionTimeoutMS=5000`.
`db:start` stores data in `backend/mongodb-data/`, binds only to localhost, and can be run again after restarting your computer. It leaves the MongoDB service on port 27017 and older `backend/mongo-data/` files untouched. If MongoDB is installed elsewhere, run `powershell -File scripts/start-mongodb.ps1 -MongodPath "C:\path\to\mongod.exe" -MongoshPath "C:\path\to\mongosh.exe"` from `backend/`.

For MongoDB Atlas, put your Atlas connection string (including the database name `scholarship_db`) in `DATABASE_URL` and skip `db:start`. Prisma transactions require a replica set. Use `prisma db push` for MongoDB schema/index changes; Prisma Migrate does not support MongoDB.

Demo accounts are `admin@scholarship.edu` (super admin), `verifier@scholarship.edu`, `committee@scholarship.edu`, and `student@scholarship.edu`. Newly created demo accounts use `Password123!`. Seeding preserves existing records and passwords, and is disabled in production. Demo scholarship deadlines are 90 and 120 days after their initial creation.

See [MongoDB database design and commands](backend/prisma/README.md) for the collection structure and verification steps.

### Frontend Setup

```bash
cd frontend

npm install
```

### Run Backend

```bash
cd backend

npm run dev
```

### Run Frontend

Open another terminal:

```bash
cd frontend

npm run dev
```

## 🐳 Docker

The complete application can be started using Docker:

```bash
docker compose up --build
```

Docker starts its own MongoDB replica set and keeps its data in the `mongodb_data` volume. Choose either the Windows MongoDB setup or Docker because both publish port 27018. For just the database, run `docker compose up -d mongodb mongodb-init`, then run `npm run db:setup` from `backend/`. To add demo data to the full Docker stack, use `docker compose exec backend npm run prisma:seed`.

## 📡 API Overview

| Module | Endpoint | Description |
|---|---|---|
| Auth | `POST /api/auth/register` | Register a new user |
| Auth | `POST /api/auth/login` | Login |
| Auth | `POST /api/auth/refresh` | Refresh authentication token |
| Scholarship | `GET /api/scholarships` | List scholarships |
| Scholarship | `POST /api/scholarships` | Create scholarship |
| Application | `POST /api/applications` | Create application |
| Application | `POST /api/applications/:id/submit` | Submit application |
| Documents | `POST /api/documents/upload` | Upload document |
| Documents | `PUT /api/documents/:id/review` | Review document |
| Workflow | `POST /api/workflow/:id/action` | Perform workflow action |
| Reports | `GET /api/reports/summary` | Get dashboard statistics |

## 🎯 Project Objective

The main objective of this project is to create a centralized digital platform that makes scholarship management **faster, more transparent, and easier to manage**.

It replaces manual processes involving paperwork, emails, and spreadsheets with a structured workflow:

**Scholarship Discovery → Application → Document Verification → Evaluation → Decision → Reporting**

## 📊 Key Highlights

- Full-stack web application
- Role-based authentication and authorization
- Scholarship management
- Multi-step applications
- Document upload and verification
- Application status tracking
- Committee evaluation workflow
- Admin dashboard and analytics
- Budget tracking
- CSV/PDF reporting
- Redis background processing
- MongoDB database with persistent storage and a replica set
- Prisma ORM
- Docker support
- CI/CD workflow

## 📚 Learning Outcomes

This project provides practical experience in:

- Full-stack web development
- React and TypeScript
- REST API development
- Database design
- MongoDB and Prisma
- Authentication and authorization
- Role-Based Access Control
- File upload and document management
- Redis and background job processing
- API validation
- Docker and deployment
- Dashboard development
- Data visualization

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Commit your changes
5. Push the branch
6. Create a Pull Request

## 📄 License

This project is licensed under the **MIT License**.
