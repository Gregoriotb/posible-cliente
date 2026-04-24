# Artificialic Budget Platform

Plataforma de gestión de presupuestos generados por chatbots IA. Entregable completo al cliente Artificialic (artificialic.com): backend REST que expone una API pública con sistema de keys estilo Stripe, y dashboard interno para que el equipo visualice y gestione los presupuestos ingeridos.

**Estado:** desplegada en producción el 2026-04-24.

---

## URLs

| Superficie | URL |
|---|---|
| Dashboard | https://posible-cliente.vercel.app |
| API | https://posible-cliente-production.up.railway.app |
| Repo | https://github.com/Gregoriotb/posible-cliente |

## Arquitectura

```
┌────────────────────┐          ┌──────────────────────┐          ┌────────────────────┐
│  Chatbots IA de    │  POST    │  Backend propio      │   GET    │  Dashboard admin   │
│  Artificialic      │ /budgets │  FastAPI + API Keys  │ /budgets │  (equipo interno)  │
│  (WhatsApp, Web…)  │ ───────▶ │  + Neon Postgres     │ ◀──────── │                    │
└────────────────────┘ X-API-Key└──────────────────────┘ X-API-Key└────────────────────┘
                                            │
                                            ▼
                                  ┌───────────────────┐
                                  │  Neon Postgres    │
                                  │  (serverless)     │
                                  └───────────────────┘
```

Nosotros proveemos la API. Artificialic es consumer: sus chatbots autentican con una key de scope `budgets:write` que emitimos desde el dashboard.

## Stack

| Capa | Tecnología | Hosting |
|---|---|---|
| Backend | FastAPI + SQLAlchemy 2.0 + Pydantic v2 + slowapi | Railway (Docker) |
| DB | Postgres 16 | Neon (serverless, scale-to-zero) |
| Frontend | React + TypeScript + Vite + Tailwind + TanStack Query + Recharts + @dnd-kit | Vercel |
| Auth del dashboard | Login user/pass → env vars en Railway |
| Auth de la API | API Keys con scopes (formato `artf_live_<48 chars>`, SHA-256 hash) |

Costo mensual: ~$5 USD (Railway Hobby; Neon y Vercel en free tier).

---

## Uso del dashboard

### Iniciar sesión

1. Entrar a `https://posible-cliente.vercel.app/login`.
2. Credenciales configuradas en env vars de Railway (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).
3. El backend valida, devuelve la admin API key y el frontend la guarda en `localStorage`. El usuario final no ve ni toca la key.

### Vistas

- **Panel** — KPIs del mes (total, conversión, tiempo respuesta, ingresos potenciales) + últimos presupuestos.
- **Presupuestos** — vista tabla o kanban (arrastrar entre columnas cambia el estado). Filtros por estado, prioridad, fuente, búsqueda. Click en una fila abre slide-over con detalle + timeline + notas + actividad.
- **Analytics** — KPIs detallados + donut por estado + bar por fuente + line chart de tendencia + top servicios.
- **Configuración** — info de sesión + gestión de API Keys + logout.

### Máquina de estados

```
recibido → en_revision → cotizado → aprobado → en_proceso → completado
    ↓           ↓           ↓           ↓            ↓
cancelado   rechazado   negociando   cancelado    cancelado
```

Transiciones inválidas bloqueadas a nivel backend. `cancelado` y `rechazado` requieren razón obligatoria. Cada cambio se registra en el historial.

### Emitir una API Key para un consumer

**Configuración → API Keys → Nueva Key**. Elegir scopes (lo típico para Artificialic: solo `budgets:write`). El plaintext aparece **una sola vez** en un modal con botón de copia — después solo se ve el prefix. Si se pierde, rotar.

**Rotar:** botón en la fila de la key. Genera una nueva y la vieja expira en 7 días para permitir migración sin downtime.

---

## Integración para Artificialic (contrato público)

El cliente envía los presupuestos que generan sus chatbots contra nuestro endpoint de ingest.

### Autenticación

Header `X-API-Key: artf_live_...` en cada request. Scope requerido: `budgets:write`. La key la entrega el admin por canal seguro (1Password, Bitwarden, email cifrado).

### Endpoint principal

```
POST https://posible-cliente-production.up.railway.app/v1/budgets
Content-Type: application/json
X-API-Key: artf_live_<token>

{
  "external_id":      "chatbot-20260424-0001",
  "client_name":      "María García",
  "client_email":     "maria@acme.com",
  "client_phone":     "+52 55 1234 5678",
  "client_company":   "ACME Corp",
  "service_type":     "Chatbot WhatsApp",
  "description":      "Chatbot 24/7 con integración al CRM.",
  "estimated_amount": "5000.00",
  "currency":         "USD",
  "priority":         "high",
  "source":           "whatsapp",
  "tags":             ["crm", "enterprise"],
  "due_date":         "2026-05-15T12:00:00Z"
}
```

Respuesta 201 con el budget creado (`id`, `status: recibido`, `created_by_key_id`, etc.).

### Campos

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `external_id` | string | ✅ | ID de Artificialic. Idempotencia: 409 si duplicado. |
| `client_name` | string | ✅ | |
| `client_email` | email | ✅ | Validación RFC. |
| `client_phone` | string | ❌ | |
| `client_company` | string | ❌ | |
| `service_type` | string | ✅ | |
| `description` | string | ✅ | |
| `estimated_amount` | decimal > 0 | ✅ | Dos decimales. |
| `currency` | 3 chars | ❌ | Default `USD`. |
| `priority` | enum | ❌ | `low` \| `medium` \| `high` \| `urgent`. |
| `source` | enum | ✅ | `whatsapp` \| `web` \| `messenger` \| `email`. |
| `tags` | string[] | ❌ | Hasta 32. |
| `due_date` | ISO-8601 | ❌ | |

### Códigos de error

| Status | Significado | Acción |
|---|---|---|
| 400 | JSON malformado | revisar payload |
| 401 | key inválida o ausente | pedir key nueva al admin |
| 403 | scope insuficiente | la key no tiene `budgets:write` |
| 409 | `external_id` duplicado | ya ingerido antes |
| 422 | validación fallida | response incluye `errors[]` |
| 429 | rate limit (60/min default) | header `Retry-After`, backoff exponencial |

### Ejemplos de integración

**curl:**
```bash
curl -X POST https://posible-cliente-production.up.railway.app/v1/budgets \
  -H "X-API-Key: artf_live_..." \
  -H "Content-Type: application/json" \
  -d '{"external_id":"x","client_name":"Ana","client_email":"a@x.com","service_type":"Chatbot","description":"...","estimated_amount":"1000","source":"whatsapp"}'
```

**Python (httpx):**
```python
import os, httpx
r = httpx.post(
    "https://posible-cliente-production.up.railway.app/v1/budgets",
    headers={"X-API-Key": os.environ["ARTIFICIALIC_BUDGET_KEY"]},
    json={"external_id": "x", "client_name": "Ana", "client_email": "a@x.com",
          "service_type": "Chatbot", "description": "...",
          "estimated_amount": "1000", "source": "whatsapp"},
    timeout=20,
)
r.raise_for_status()
```

**Node (fetch):**
```js
const r = await fetch("https://posible-cliente-production.up.railway.app/v1/budgets", {
  method: "POST",
  headers: { "X-API-Key": process.env.ARTIFICIALIC_BUDGET_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    external_id: "x", client_name: "Ana", client_email: "a@x.com",
    service_type: "Chatbot", description: "...",
    estimated_amount: "1000", source: "whatsapp",
  }),
});
```

---

## Operación

### Env vars en Railway (backend)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Connection string de Neon (formato `postgresql://...` — el backend la normaliza a psycopg v3) |
| `CORS_ORIGINS` | URLs separadas por coma (al menos la del dashboard en Vercel) |
| `RATE_LIMIT_DEFAULT` | `60` |
| `BOOTSTRAP_ADMIN_ON_EMPTY` | `false` en prod (solo `true` en el primer deploy) |
| `ENABLE_DOCS` | `false` en prod para ocultar Swagger |
| `ENVIRONMENT` | `production` |
| `ADMIN_USERNAME` | Usuario del login del dashboard |
| `ADMIN_PASSWORD` | Contraseña del login |
| `ADMIN_API_KEY` | Plaintext de la admin API key que el login devuelve |

### Env vars en Vercel (frontend)

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://posible-cliente-production.up.railway.app` *(sin `/v1`; el cliente lo añade)* |

### Logs

```bash
railway logs --service posible-cliente   # backend
# UI Railway → Deployments → Logs
# UI Vercel → Deployments → Functions → Logs
```

### Comandos administrativos (CLI)

Ejecutables localmente con `DATABASE_URL` apuntando a Neon, o vía `railway run`:

```bash
python cli.py create-key --name "..." --scope budgets:write
python cli.py list-keys
python cli.py revoke-key <uuid>
python cli.py seed --reset    # recrea data demo; destructivo
```

### Rotar la admin key del dashboard

1. Crear nueva: `railway run python cli.py create-key --name "Admin N" --scope admin --scope budgets:read --scope budgets:update`.
2. Railway → Variables → `ADMIN_API_KEY` → pegar el nuevo plaintext.
3. Railway auto-redeploya.
4. Desde el dashboard, revocar la key vieja.

---

## Desarrollo local

### Backend

```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env             # DATABASE_URL default = SQLite local
uvicorn app.main:app --reload    # http://localhost:8000
pytest tests/                    # 60 tests
```

Con `BOOTSTRAP_ADMIN_ON_EMPTY=true` en `.env`, el primer arranque crea una admin key y la persiste en `ADMIN_KEY.txt`. Poner ese plaintext como `ADMIN_API_KEY` en `.env` para que el login local funcione.

### Frontend

```bash
cd dashboard
npm install
cp .env.example .env             # VITE_API_URL=http://localhost:8000
npm run dev                      # http://localhost:5173
npm run build                    # prod
```

### Git workflow

- `master` = resultado estable (lo que está en prod).
- `develop` = integración para siguiente release.
- Railway y Vercel auto-redeployan desde `master` al hacer `git push`.

## Paleta Artificialic

```
--ai-primary:   #22C55E    Verde principal (acción positiva)
--ai-secondary: #3B82F6    Azul digital
--ai-accent:    #8B5CF6    Violeta
--ai-danger:    #EF4444    ai-warning: #F59E0B    ai-info: #06B6D4
Gradiente: linear-gradient(135deg, #3B82F6, #8B5CF6, #22C55E)
```

## Estructura del repo

```
api/                                backend FastAPI
├── app/
│   ├── main.py
│   ├── core/     config · security · limiter · dependencies · logging_filter
│   ├── db/       base · session · seed
│   ├── models/   api_key · budget · note · status_change
│   ├── schemas/  Pydantic v2 por dominio
│   ├── routes/   auth · meta · ingest · dashboard · analytics · admin
│   └── services/ api_key_service · budget_service · analytics_service · status_machine
├── tests/        60 tests
├── cli.py
├── Dockerfile · docker-compose.yml · .env.example · requirements.txt

dashboard/                          frontend React
├── src/
│   ├── api/      client · budgets · analytics · admin · types
│   ├── hooks/    useBudgets · useBudgetDetail · useAnalytics · useAdmin
│   ├── components/
│   │   ├── layout/   AppLayout · Sidebar · Header · MobileDrawer · ProtectedRoute
│   │   ├── budgets/  BudgetTable · BudgetKanban · BudgetFilters · BudgetDetailSlideOver
│   │   └── shared/   StatusBadge · PriorityBadge · SourceIcon
│   ├── pages/    LoginPage · DashboardPage · BudgetListPage · AnalyticsPage · SettingsPage
│   ├── lib/      cn · format · status
│   └── App.tsx · main.tsx · index.css
├── public/artificialic-logo.svg
└── tailwind.config.js · vite.config.ts · tsconfig.app.json · package.json · .env.example
```
