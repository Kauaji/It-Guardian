# IT Guardian

IT Guardian is a functional infrastructure monitoring MVP. It combines Zabbix-style metrics with OCS Inventory-style hardware/software data and exposes an admin dashboard for operations teams.

## Stack

- Backend: Node.js, Express, JWT, WebSocket
- Frontend: React, Vite, Recharts, Lucide icons
- Database: PostgreSQL
- Deploy: Docker Compose with API, web app and Postgres
- Integrations: service adapters prepared for Zabbix and OCS APIs, using realistic mock data by default

## Features

- User registration and login
- JWT protected API
- Role-based access control: `admin`, `operator`, `viewer`
- PostgreSQL persistence for users, audit logs and alert acknowledgements
- Dashboard with monitored devices
- Device status: Online, Offline, Problem
- CPU, RAM, disk, network and uptime metrics
- Hardware and software inventory with segment organization
- Vertical inventory segment cards with drag-and-drop, move actions and custom segment colors
- Active and historical alerts
- Persistent alert acknowledgement
- Search and filters by name, IP and status
- Device detail page with charts
- Visual toast notifications
- WebSocket updates on `/ws` plus polling fallback every 15 seconds

## Project Structure

```text
it-guardian/
  client/        React + Vite app
  server/        Express API
  server/src/
    controllers/ HTTP controllers
    data/        mock Zabbix and OCS datasets
    middleware/  auth and RBAC middleware
    repositories/PostgreSQL repositories
    routes/      API route definitions
    services/    Zabbix, OCS, alerts and realtime orchestration
```

## Run With Docker Compose

Make sure Docker Desktop or the Docker daemon is running.

```bash
npm run docker:up
```

Open:

- Frontend: http://localhost:5173
- Backend health: http://localhost:4000/api/health
- WebSocket: ws://localhost:4000/ws

Stop:

```bash
npm run docker:down
```

## Run Locally

Install dependencies:

```bash
npm install
```

Start Postgres:

```bash
docker compose up db -d
```

If you already have PostgreSQL running, set `DATABASE_URL` in `server/.env` instead.

Create backend environment file:

```bash
cp server/.env.example server/.env
```

Start the backend:

```bash
npm run dev:server
```

In another terminal, start the frontend:

```bash
npm run dev:client
```

## Demo Account

```text
email: admin@itguardian.local
password: admin123
role: admin
```

Newly registered users receive the `operator` role by default.

## API Overview

Protected routes require:

```http
Authorization: Bearer <token>
```

Endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/devices?search=&status=`
- `GET /api/devices/:id`
- `PATCH /api/devices/:id/segment` (`admin`, `operator`)
- `GET /api/segments`
- `POST /api/segments` (`admin`, `operator`)
- `PATCH /api/segments/:id` (`admin`, `operator`) for name and color updates
- `DELETE /api/segments/:id` (`admin`, `operator`)
- `GET /api/alerts`
- `GET /api/alerts/history`
- `POST /api/alerts/:id/acknowledge` (`admin`, `operator`)
- `DELETE /api/alerts/:id/acknowledge` (`admin`, `operator`)
- `GET /api/logs` (`admin`)
- `GET /api/users` (`admin`)
- `PATCH /api/users/:id/role` (`admin`)

## Database

The API creates these tables on startup when they do not exist:

- `users`
- `audit_logs`
- `alert_acknowledgements`
- `inventory_segments`
- `device_segments`

Default local connection:

```text
postgres://itguardian:itguardian@localhost:5432/itguardian
```

## Integration Notes

The MVP still uses mock monitoring data, but the backend is organized so real integrations can replace the mock clients:

- `server/src/services/zabbixService.js`
- `server/src/services/ocsService.js`

For production, replace those methods with API calls to:

- Zabbix JSON-RPC API for hosts, triggers, items and history
- OCS Inventory REST API for hardware and software inventory

## Production Hardening Ideas

- Move schema migrations to a dedicated migration tool
- Store JWT secrets in a secret manager
- Add refresh tokens and session revocation
- Add alert ownership and escalation workflows
- Add WebSocket horizontal scaling through Redis pub/sub
