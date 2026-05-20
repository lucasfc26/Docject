# Projectfy Roadmap

## Visão Geral

Projectfy é uma plataforma SaaS de gestão de projetos com portal administrativo e portal do cliente.

### Stack

**Frontend:** React + TypeScript + Vite + TailwindCSS + React Router + Zustand + React Query + React Hook Form + Zod

**Backend:** NestJS + Prisma + PostgreSQL + Redis + JWT + Swagger

**Infra:** Docker + Docker Compose + NGINX + Cloudflare

---

# Arquitetura

## Fluxo

Cloudflare -> NGINX Reverse Proxy -> Frontend Container / Backend API -> PostgreSQL + Redis

## Containers

- frontend
- backend
- postgres
- redis
- nginx

---

# Estrutura do Projeto

```txt
projectfy/
  frontend/
    src/
      components/
      pages/
      layouts/
      routes/
      hooks/
      stores/
      services/
      types/
      utils/
  backend/
    src/
      modules/
      common/
      config/
      prisma/
  nginx/
  docker/
  docs/
  scripts/
```

---

# Roadmap de Desenvolvimento

## Fase 1 — Foundation

- bootstrap frontend
- bootstrap backend
- docker compose
- nginx
- env configs
- lint/formatter
- prisma init
- swagger setup

## Fase 2 — Auth

- login
- refresh token
- logout
- forgot password
- reset password
- RBAC

## Fase 3 — Clientes

- CRUD clientes
- contatos
- histórico

## Fase 4 — Projetos

- CRUD projetos
- módulos
- milestones
- progresso

## Fase 5 — Contratos

- upload pdf
- aceite
- versionamento

## Fase 6 — Financeiro

- receitas
- despesas
- parcelas
- dashboards

## Fase 7 — Agenda

- reuniões
- lembretes
- calendário

## Fase 8 — Notificações

- email
- whatsapp
- in-app

## Fase 9 — Portal Cliente

- dashboard cliente
- progresso
- contratos
- financeiro

## Fase 10 — Production Hardening

- observability
- backups
- CI/CD
- WAF

---

# Banco de Dados

## Enums

```prisma
enum UserRole {
  ADMIN
  MANAGER
  FINANCIAL
  CLIENT
}

enum ProjectStatus {
  PLANNING
  IN_PROGRESS
  PAUSED
  WAITING_CLIENT
  COMPLETED
  CANCELLED
}

enum ContractStatus {
  DRAFT
  SENT
  SIGNED
  CANCELLED
}

enum TransactionStatus {
  PENDING
  PAID
  OVERDUE
  CANCELLED
}
```

## Models principais

- User
- RefreshToken
- Client
- ClientContact
- Project
- ProjectMember
- ProjectModule
- Milestone
- Contract
- ContractVersion
- FinancialTransaction
- Resource
- ResourceAllocation
- Appointment
- Notification
- FileUpload
- Comment
- ActivityLog
- SystemSettings

---

# Migration Plan

## 001_init_users_roles

- users
- roles
- permissions

## 002_auth

- refresh_tokens
- password_reset_tokens
- sessions

## 003_clients

- clients
- client_contacts

## 004_projects

- projects
- project_members

## 005_project_modules

- project_modules
- milestones

## 006_contracts

- contracts
- contract_versions

## 007_financial

- financial_transactions

## 008_resources

- resources
- resource_allocations

## 009_appointments

- appointments

## 010_notifications

- notifications

## 011_uploads

- file_uploads

## 012_comments

- comments

## 013_activity_logs

- activity_logs

## 014_settings

- system_settings

## Prisma commands

```bash
npx prisma init
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed
```

---

# Backend Modules

## AuthModule

Endpoints:

```http
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
GET /auth/me
```

## UsersModule

```http
GET /users
POST /users
PATCH /users/:id
DELETE /users/:id
```

## ClientsModule

```http
GET /clients
POST /clients
GET /clients/:id
PATCH /clients/:id
DELETE /clients/:id
```

## ProjectsModule

```http
GET /projects
POST /projects
GET /projects/:id
PATCH /projects/:id
DELETE /projects/:id
```

## ContractsModule

## FinancialModule

## ResourcesModule

## AppointmentsModule

## NotificationsModule

## UploadsModule

## IntegrationsModule

---

# Frontend Pages

## Auth

- /login
- /forgot-password
- /reset-password

## Admin

- /dashboard
- /clients
- /clients/:id
- /projects
- /projects/:id
- /contracts
- /financial
- /resources
- /appointments
- /notifications
- /settings

## Client Portal

- /client/dashboard
- /client/project
- /client/contracts
- /client/financial
- /client/appointments
- /client/notifications

---

# UI Components

- Button
- Input
- Select
- Modal
- Drawer
- Sidebar
- Topbar
- Card
- KPI Card
- DataTable
- Pagination
- Tabs
- Toast
- FileUploader
- Calendar
- ChartCard
- ProgressRing
- Skeleton
- ConfirmDialog
- CommandPalette

---

# Redis Usage

- session cache
- refresh token blacklist
- dashboard cache
- rate limit
- notification queue
- email queue
- whatsapp queue

---

# Notifications

Triggers:

- contrato criado
- contrato assinado
- pagamento vencendo
- pagamento atrasado
- entrega concluída
- projeto atualizado
- reunião agendada

---

# Email Templates

- welcome
- forgot password
- contract sent
- payment reminder
- delivery completed
- appointment reminder

---

# WhatsApp Integration

Provider abstraction:

- Evolution API
- Twilio
- Z-API

Methods:

- sendMessage()
- sendTemplate()
- sendMedia()

---

# Docker Services

```yaml
services:
  frontend:
  backend:
  postgres:
  redis:
  nginx:
```

---

# NGINX

Routes:

- / -> frontend
- /api -> backend

Features:

- gzip
- security headers
- websocket proxy
- caching

---

# Cloudflare

- DNS proxy
- SSL Full Strict
- WAF
- rate limiting
- bot protection
- cache rules

---

# Segurança

- JWT rotation
- bcrypt
- Helmet
- CORS
- input validation
- sanitization
- RBAC
- audit logs
- brute force protection

---

# CI/CD

GitHub Actions:

- lint
- test
- build
- prisma migrate
- docker build
- docker push
- deploy VPS

---

# Testing

Frontend:

- Vitest
- RTL

Backend:

- Jest
- e2e tests

---

# Environment Variables

## Frontend

```env
VITE_API_URL=
VITE_APP_NAME=Projectfy
```

## Backend

```env
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
WHATSAPP_PROVIDER=
WHATSAPP_API_URL=
WHATSAPP_API_TOKEN=
```

---

# Deploy VPS

Ubuntu 24 LTS:

```bash
git clone ...
docker compose up -d --build
```

Checklist:

- DNS cloudflare
- SSL
- firewall
- backups
- monitoring

---

# MVP Scope

Entrega inicial:

- auth
- clientes
- projetos
- módulos
- contratos
- financeiro
- notificações
- portal cliente

---

# Pós-MVP

- assinatura digital real
- billing SaaS
- multi-tenant
- API pública
- automações
- relatórios PDF
- dashboards avançados
- webhook integrations

admin@projectfy.io
projectfy
