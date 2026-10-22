# 🎓 Adaptive Scholarship Management System

A full-stack scholarship management platform designed to simplify and digitize the complete scholarship application process. The system manages scholarship discovery, applications, document verification, evaluation, approval, and reporting through a role-based workflow.

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
│   └── PostgreSQL + Prisma ORM
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
| Database | PostgreSQL |
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

### Prerequisites

Make sure you have the following installed:

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- npm
- Git

### Backend Setup

```bash
cd backend

npm install

npx prisma generate

npx prisma db push

npx prisma db seed
```

Create and configure your `.env` file with the required database, Redis, authentication, and storage variables.

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
docker-compose up --build
```

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
- PostgreSQL database
- Prisma ORM
- Docker support
- CI/CD workflow

## 📚 Learning Outcomes

This project provides practical experience in:

- Full-stack web development
- React and TypeScript
- REST API development
- Database design
- PostgreSQL and Prisma
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
