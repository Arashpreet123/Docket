# Docket

A task management app built to learn Docker — featuring **Django REST API**, **PostgreSQL**, and **React**, all orchestrated with Docker Compose.

---

## Stack

| Service    | Technology          | Port  |
|------------|---------------------|-------|
| `frontend` | React               | 3000  |
| `backend`  | Django + DRF        | 8000  |
| `db`       | PostgreSQL 15       | 5432  |

---

## Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Run the app

```bash
# Clone / open the project folder
cd docket

# Build and start all services
docker compose up --build

# In a new terminal, open the app
open http://localhost:3000
```

> First run takes ~2 minutes to pull images and install dependencies.

---

## What You'll Learn

### Docker Concepts Used

| Concept | Where |
|---|---|
| `Dockerfile` | `backend/Dockerfile`, `frontend/Dockerfile` |
| Multi-container orchestration | `docker-compose.yml` |
| Service networking | Backend reaches DB via hostname `db` |
| Health checks | DB must be ready before backend starts |
| Named volumes | PostgreSQL data persists between restarts |
| Bind mounts | Live code reloading in development |
| Environment variables | DB credentials, API URLs |

### Architecture

```
Browser
  │
  ├── :3000  →  React (Create React App)
  │               │
  │               └── HTTP → :8000
  │
  └── :8000  →  Django (runserver)
                  │
                  └── PostgreSQL (:5432)
```

---

## API Endpoints

```
GET    /api/tasks/          List all tasks
POST   /api/tasks/          Create a task
GET    /api/tasks/:id/      Get a task
PATCH  /api/tasks/:id/      Update a task
DELETE /api/tasks/:id/      Delete a task
GET    /api/tasks/stats/    Get summary stats
```

### Example request
```bash
curl -X POST http://localhost:8000/api/tasks/ \
  -H "Content-Type: application/json" \
  -d '{"title": "Learn Docker", "priority": "high"}'
```

---

## Useful Commands

```bash
# Start services (detached)
docker compose up -d

# Watch logs
docker compose logs -f

# Watch just backend
docker compose logs -f backend

# Run Django management commands
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py shell

# Connect to Postgres directly
docker compose exec db psql -U docket -d docket

# Stop everything
docker compose down

# Stop and remove volumes (wipes DB)
docker compose down -v

# Rebuild after code changes to Dockerfile or requirements
docker compose up --build
```

---

## Project Structure

```
docket/
├── docker-compose.yml        ← Orchestrates all 3 services
│
├── backend/
│   ├── Dockerfile            ← Python 3.11 image
│   ├── requirements.txt      ← Django, DRF, psycopg2, cors-headers
│   ├── manage.py
│   ├── docket/               ← Django project
│   │   ├── settings.py       ← Reads DB config from env vars
│   │   └── urls.py
│   └── tasks/                ← Tasks app
│       ├── models.py         ← Task model (title, priority, completed)
│       ├── serializers.py
│       ├── views.py          ← TaskViewSet + /stats/ action
│       └── urls.py
│
└── frontend/
    ├── Dockerfile            ← Node 18 image
    ├── package.json          ← Proxies API to backend service
    └── src/
        ├── App.js            ← Full UI (no extra dependencies!)
        └── index.css         ← Ledger-paper aesthetic
```

---

## Django Admin

Create a superuser to access the admin panel at `http://localhost:8000/admin/`:

```bash
docker compose exec backend python manage.py createsuperuser
```

## Nginx added

## Updated Architecture
Browser
   │
   └── :80 → Nginx (reverse proxy)
              │
              ├── /      → React (frontend:3000)
              └── /api/  → Django (backend:8000)
                               │
                               └── PostgreSQL (db:5432)

Nginx acts as a gateway - clients never communicate directly with backend services.
Without Nginx:
* Multiple exposed ports increase the attack surface
* Clients must know different service URLs
* No central entry point for routing requests