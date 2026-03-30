# Docket

A task management app that evolved into a real-time data ingestion and processing system — built to learn Docker, Django, PostgreSQL, React, Nginx, and load testing.

---

## Stack

| Service       | Technology             | Port         |
|---------------|------------------------|--------------|
| `nginx`       | Nginx (reverse proxy)  | 80 (public)  |
| `frontend`    | React                  | 3000 (internal) |
| `backend`     | Django + DRF           | 8000 (internal) |
| `db`          | PostgreSQL 15          | 5432 (internal) |
| `simulator`   | Python script          | none         |
| `locust`      | Locust load testing    | 8089 (public) |

"Internal" means the port is only reachable between containers — not from your browser. Only Nginx (port 80) and Locust (port 8089) are exposed to your machine.

---

## Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Run the app

```bash
cd docket
cp .env.example .env      # set your credentials
docker compose up --build
open http://localhost      # port 80 via Nginx
```

> First run takes 2–3 minutes to pull images and install dependencies.

---

## Architecture

### How requests flow through the system

```
Your Browser
     │
     └── :80 ──► Nginx (the only public door)
                   │
                   ├── /api/*  ──► Django backend (backend:8000)
                   │                    │
                   │                    └── PostgreSQL (db:5432)
                   │
                   └── /*      ──► React frontend (frontend:3000)

Simulator (background container)
     └── POST /api/events/ ──► Django ──► PostgreSQL

Locust (load tester)
     └── :8089 ──► browser UI ──► hammers Nginx at :80
```

Every browser request goes through Nginx first. Nginx reads the URL path and decides which container to forward it to. The backend and frontend are never directly reachable from the outside — only Nginx talks to them.

### Docker networking

When you run `docker compose up`, Docker automatically creates a private network and connects all services to it. Inside this network, containers find each other by **service name** instead of IP address. This is why Django connects to `db:5432` instead of `localhost:5432`, and why the simulator posts to `http://backend:8000` — `db` and `backend` are service names defined in `docker-compose.yml`.

```
┌─────────────────── Docker private network ─────────────────────┐
│                                                                  │
│   nginx ◄──► frontend    nginx ◄──► backend ◄──► db            │
│                                         ▲                        │
│                                    simulator                     │
└─────────────────────────────────────────────────────────────────┘
```

Nothing inside this network is reachable from outside unless you explicitly map a port with `ports:` in docker-compose.yml. That's why the DB is safe even though it has no password protection on the network level — it's simply unreachable from outside.

---

## Services explained

### Nginx — reverse proxy

Nginx is the only container that exposes a public port (80). Everything routes through it.

**Why Nginx?**

Without Nginx, you'd expose both `:3000` (React) and `:8000` (Django) directly to the outside world. That means two entry points to secure, two URLs to manage, and no central place to add SSL, rate limiting, or routing logic later. With Nginx, there's one door.

Nginx also solves the CORS problem elegantly. Without it, the browser makes requests from `localhost:3000` to `localhost:8000` — two different origins, triggering CORS restrictions. With Nginx, everything comes from the same origin (`:80`), so the browser treats it as same-origin and CORS is no longer an issue.

```nginx
# nginx/nginx.conf — simplified

location /api/ {
    proxy_pass http://backend:8000;    # Django handles API calls
}

location / {
    proxy_pass http://frontend:3000;   # React handles everything else
}
```

**What "reverse proxy" means:** a regular proxy hides the *client* (like a VPN). A reverse proxy hides the *servers*. The browser talks to Nginx on :80 and has no idea Django or React even exist as separate services.

---

### Backend — Django REST API

Django handles all data logic. It exposes a REST API that returns JSON — it has no HTML of its own. The frontend fetches this JSON and renders it.

**Why `expose` instead of `ports`?**

In the original version, the backend used `ports: "8000:8000"` which mapped the container port to your host machine. After adding Nginx, it uses `expose: "8000"` instead. This makes port 8000 reachable *within the Docker network* (so Nginx can reach it) but *not from your host machine*. You can no longer hit `localhost:8000` directly — all traffic goes through Nginx at `:80`. This is intentional: it closes an unnecessary entry point.

**Two Django apps:**

`tasks/` — the original task manager. CRUD operations on tasks with priority and completion status.

`events/` — the new data ingestion layer. Accepts sensor readings, applies alert logic, and stores them. The `perform_create()` method runs on every POST — if the value exceeds 90, it sets `alert=True` before saving.

```python
# events/views.py
def perform_create(self, serializer):
    value = serializer.validated_data.get('value', 0)
    serializer.save(alert=value > ALERT_THRESHOLD)
```

This is *inline processing* — the alert decision happens inside the API request itself. In Phase 3 (Celery), this logic will move to a background worker so the API can return immediately without waiting for processing to finish.

---

### Database — PostgreSQL

PostgreSQL stores all data. Django's ORM translates Python model code into SQL automatically — you define a Python class, run `makemigrations` to generate the SQL instructions, then `migrate` to execute them.

**The migration two-step:**

```
models.py  →  makemigrations  →  0001_initial.py  →  migrate  →  table in PostgreSQL
(you write)     (generates)       (auto-generated)    (executes)
```

Django never reads `models.py` directly to create tables. The migration file is the intermediate translation layer. It should be committed to git like any other code.

**Data persistence via named volumes:**

```yaml
volumes:
  postgres_data:         # declared here at the top level

db:
  volumes:
    - postgres_data:/var/lib/postgresql/data   # mounted here
```

The volume is a folder Docker manages on your host machine, mounted inside the container at the path PostgreSQL uses to store its data files. When the container stops or is deleted, the volume stays. The data lives on your machine, not inside the container.

```
docker compose down       →  containers deleted, volume survives ✓
docker compose up         →  new container mounts the same volume, data returns ✓
docker compose down -v    →  containers AND volume deleted, data gone ✗
```

**Health check:**

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
  interval: 5s
  retries: 5
```

`pg_isready` pings PostgreSQL to check if it's accepting connections. Docker runs this every 5 seconds. The backend service has `depends_on: db: condition: service_healthy` — meaning it won't start until this check passes. Without this, Django would try to run migrations before PostgreSQL is ready and fail.

---

### Frontend — React

React is what you see in the browser. It has no database of its own — it makes `fetch()` calls to `/api/` (which Nginx routes to Django), gets JSON back, and renders it.

The app has two tabs:

**Docket tab** — the original task manager. Create, complete, and delete tasks with priority levels.

**Dashboard tab** — the new events view. Polls `/api/events/` every 2 seconds and renders a live stream of sensor readings with sparkline charts per sensor type. Red alert badges appear when values exceed the threshold.

The polling loop is simple:
```javascript
useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 2000);
    return () => clearInterval(interval);  // cleanup on unmount
}, [loadEvents]);
```

This will be replaced by WebSockets in Phase 5 — instead of asking for new data every 2 seconds, the server will push it the instant it arrives.

**Bind mounts for live reloading:**

```yaml
volumes:
  - ./frontend/src:/app/src
```

This maps your local `src/` folder directly into the container. When you edit a file, the container sees the change immediately and hot-reloads the browser. You don't need to rebuild the image to see code changes.

---

### Simulator

A Python script in its own Docker container that generates fake sensor data and fires it at the backend every second.

```python
while True:
    payload = {
        'source': random.choice(['sensor_1', 'sensor_2', 'sensor_3']),
        'type':   random.choice(['temperature', 'pressure', 'humidity']),
        'value':  round(random.uniform(60, 110), 2),
    }
    requests.post(f'{API}/events/', json=payload)
    time.sleep(1)
```

The key learning here is that it uses `http://backend:8000` — the Docker service name — not `http://localhost:8000`. Inside the Docker network, `backend` resolves to the backend container's IP address automatically. `localhost` inside any container refers to *that container itself*, not the host machine or other containers.

The simulator depends on the backend service being healthy before it starts, and uses `restart: on-failure` so it retries automatically if the backend isn't ready yet.

---

### Locust — load testing

Locust is a Python-based load testing tool with a browser UI. It simulates multiple users hammering your API simultaneously so you can see where the system breaks down.

```bash
open http://localhost:8089   # Locust web UI
```

From the UI you set the number of simulated users and spawn rate, then watch requests per second, response times, and error rates in real time.

The test file (`locust/locustfile.py`) defines what users do:

```python
class DocketUser(HttpUser):
    @task
    def post_event(self):
        self.client.post("/api/events/", json={
            "source": "sensor_1",
            "type": "temperature",
            "value": random.uniform(60, 110),
        })
```

Locust targets Nginx (`:80`) not the backend directly — this is correct, because in production traffic always enters through the proxy. Testing the backend directly would give you misleading results that don't reflect real conditions.

**What to watch during a load test:**
- Response time p95 climbing — the system is starting to queue requests
- Error rate rising — something is refusing connections or timing out
- `docker compose logs backend` — Django logging slow queries or exceptions
- `docker compose logs db` — PostgreSQL logging connection limits

Since Django's `runserver` is single-threaded, you'll hit its limit quickly. That's the point — it teaches you *why* Gunicorn (Phase 2 upgrade) and eventually async workers (Phase 3) matter.

---

## Environment variables

All secrets live in `.env` which is never committed to git. docker-compose.yml reads from it using `${VARIABLE_NAME}` syntax.

```bash
# .env (copy from .env.example)
SECRET_KEY=your-secret-key-here
POSTGRES_DB=docket
POSTGRES_USER=docket
POSTGRES_PASSWORD=your-strong-password
DB_NAME=docket
DB_USER=docket
DB_PASSWORD=your-strong-password
DB_HOST=db
DB_PORT=5432
REACT_APP_API_URL=http://localhost/api
```

The `DB_HOST=db` value is the Docker service name — Django connects to the database container using this hostname, not an IP address.

---

## API Reference

### Tasks

```
GET    /api/tasks/             List tasks (filter: ?completed=true/false&priority=high)
POST   /api/tasks/             Create a task
PATCH  /api/tasks/:id/         Update a task
DELETE /api/tasks/:id/         Delete a task
GET    /api/tasks/stats/       Summary counts by status and priority
```

### Events

```
GET    /api/events/            List events (filter: ?type=temperature&alert=true&limit=50)
POST   /api/events/            Ingest an event (alert flag set automatically)
GET    /api/events/stats/      Total count, alert count, latest reading
```

#### Ingest an event manually

```bash
curl -X POST http://localhost/api/events/ \
  -H "Content-Type: application/json" \
  -d '{"source": "sensor_1", "type": "temperature", "value": 95.5}'

# Response includes alert: true because 95.5 > 90
```

---

## Useful commands

```bash
# Start everything
docker compose up --build

# Start in background
docker compose up -d

# Watch all logs
docker compose logs -f

# Watch one service
docker compose logs -f backend

# Run Django migrations manually
docker compose exec backend python manage.py migrate

# Create new migration after changing a model
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate

# Open a Django shell
docker compose exec backend python manage.py shell

# Connect to PostgreSQL directly
docker compose exec db psql -U docket -d docket

# List tables
docker compose exec db psql -U docket -d docket -c "\dt"

# Stop (keeps data)
docker compose stop

# Stop and remove containers (keeps volume/data)
docker compose down

# Wipe everything including database
docker compose down -v

# Rebuild after changing Dockerfile or requirements.txt
docker compose up --build
```

---

## Project structure

```
docket/
├── .env                          ← secrets (never commit)
├── .env.example                  ← template to copy from
├── .gitignore
├── docker-compose.yml            ← all 5 services, network, volume
│
├── nginx/
│   └── nginx.conf                ← routes /api/ to Django, / to React
│
├── backend/
│   ├── Dockerfile                ← python:3.11-slim image
│   ├── requirements.txt
│   ├── manage.py
│   ├── docket/                   ← Django project config
│   │   ├── settings.py           ← reads all config from env vars
│   │   └── urls.py               ← registers tasks/ and events/ routes
│   ├── tasks/                    ← original task manager app
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── migrations/
│   └── events/                   ← new data ingestion app
│       ├── models.py             ← Event (source, type, value, alert)
│       ├── serializers.py
│       ├── views.py              ← alert logic in perform_create()
│       └── migrations/
│
├── frontend/
│   ├── Dockerfile                ← node:18-alpine image
│   ├── package.json
│   └── src/
│       ├── App.js                ← Docket + Dashboard tabs
│       └── index.css
│
├── simulator/
│   ├── Dockerfile                ← minimal python:3.11-slim image
│   └── simulator.py              ← posts random events every second
│
└── locust/
    └── locustfile.py             ← defines load test user behaviour
```

---

## What's coming next

### Phase 3 — Celery + Redis (async processing)

Right now alert detection runs *inside* the API request. The client has to wait for it to finish before getting a response. For simple threshold logic this is fine, but if processing were expensive (image analysis, ML inference, external API calls), the API would become slow.

The fix is to hand the work off to a background worker:

```
POST /api/events/  →  Django saves to DB  →  pushes task ID to Redis queue
                                                        ↓
                                              Celery worker picks it up
                                              runs processing asynchronously
```

The API returns in milliseconds. The worker runs in its own container on its own schedule. This adds two new services to docker-compose.yml: `redis` and `worker`.

### Phase 4 — WebSockets

Replace the 2-second polling loop with a persistent WebSocket connection. Instead of the browser asking "anything new?" every 2 seconds, Django pushes new events the instant they arrive. Requires Django Channels and a channel layer backed by Redis.

### Phase 5 — Kubernetes

Once the full system works in Compose, convert it to Kubernetes manifests. Every Compose concept maps directly to a K8s equivalent: services become Deployments, `expose` becomes a Service, volumes become PersistentVolumeClaims, and env vars become ConfigMaps and Secrets.