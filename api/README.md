# Artificialic Budget Platform — API Backend

> **Qué es:** API REST que expone los endpoints consumidos por (a) los chatbots IA de Artificialic (ingest de presupuestos) y (b) el dashboard administrativo interno (lectura y gestión). Autenticación por **API Keys con scopes** estilo Stripe/SendGrid.

**Arquitectura:** esta API es el corazón de la plataforma. Los chatbots mandan `POST /v1/budgets` con su key. El dashboard consume el resto con otra key de scope distinto.

- Documentación interactiva: `http://localhost:8000/docs` (Swagger) o `/redoc`.
- Spec maestro del proyecto: [`../ARTIFICIALIC_DASHBOARD_CONTEXT.md`](../ARTIFICIALIC_DASHBOARD_CONTEXT.md).

---

## Setup local (dev)

```bash
cd "posible cliente/api"
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Primer arranque (DB vacía) con `BOOTSTRAP_ADMIN_ON_EMPTY=true`:
- Crea automáticamente una admin key.
- La imprime en stdout y la guarda en `ADMIN_KEY.txt` (chmod 600).
- Usa esa key en el dashboard → Configuración → "Admin API Key".

Alternativa: generar con CLI en vez de bootstrap automático:
```bash
python cli.py seed --reset              # crea 3 keys demo + 40 budgets
python cli.py create-key --name "Artificialic Prod" --scope budgets:write
python cli.py list-keys
python cli.py revoke-key <uuid>
```

---

## Docker

```bash
docker compose up --build
```

Expone en `http://localhost:8000`. La DB queda en volumen `api_data` (SQLite).

---

## Integration Guide — Artificialic

**Esta sección es lo que le entregas a Artificialic** para que sus chatbots ingiesten presupuestos.

### Autenticación

Cada request a la API requiere el header `X-API-Key` con un token válido emitido por el admin del dashboard.

```
X-API-Key: artf_live_<48 chars url-safe>
```

El token se muestra **una sola vez** al momento de crearlo desde el dashboard (Configuración → API Keys → Nueva Key con scope `budgets:write`). No podemos recuperarlo después; si se pierde, se rota.

### Base URL

- **Producción:** `https://api.<nuestro-dominio>.com/v1` (el URL final se te comparte al entregar).
- **Desarrollo / integración inicial:** `http://localhost:8000/v1`.

### Endpoint principal: crear presupuesto

```
POST /v1/budgets
Content-Type: application/json
X-API-Key: artf_live_...

{
  "external_id":      "chatbot-20260423-0001",
  "client_name":      "María García",
  "client_email":     "maria@acme.com",
  "client_phone":     "+52 55 1234 5678",
  "client_company":   "ACME Corp",
  "service_type":     "Chatbot WhatsApp",
  "description":      "Necesitan chatbot 24/7 con integración al CRM.",
  "estimated_amount": "5000.00",
  "currency":         "USD",
  "priority":         "high",
  "source":           "whatsapp",
  "tags":             ["crm", "enterprise"],
  "due_date":         "2026-05-15T12:00:00Z"
}
```

**Respuesta 201:** el budget creado, con `id`, `status=recibido`, `created_at`, `created_by_key_id`, y un `status_changes[0]` inicial.

### Campos del payload

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `external_id` | string | ✅ | ID en el sistema de Artificialic. Idempotencia: si se envía un `external_id` ya usado, recibes 409. |
| `client_name` | string | ✅ | |
| `client_email` | email | ✅ | Validación estricta RFC. |
| `client_phone` | string | ❌ | |
| `client_company` | string | ❌ | |
| `service_type` | string | ✅ | Ej: "Chatbot WhatsApp", "Catálogo Inteligente". |
| `description` | string | ✅ | Resumen de lo que solicitó el cliente. |
| `estimated_amount` | decimal > 0 | ✅ | String o número. Dos decimales. |
| `currency` | string (3) | ❌ | Default `USD`. Se normaliza a mayúsculas. |
| `priority` | enum | ❌ | `low` \| `medium` \| `high` \| `urgent`. Default `medium`. |
| `source` | enum | ✅ | `whatsapp` \| `web` \| `messenger` \| `email`. |
| `tags` | string[] | ❌ | Hasta 32 tags. |
| `due_date` | ISO-8601 | ❌ | |

### Errores esperados

| Status | Significado | Qué hacer |
|---|---|---|
| 400 | Formato de request inválido | Revisar payload/headers. |
| 401 | API Key inválida, ausente, revocada o expirada | Pedir nueva key al admin. No reintentar con la misma. |
| 403 | La key existe pero no tiene el scope requerido (`budgets:write`) | Pedir al admin regenerar con el scope correcto. |
| 409 | `external_id` duplicado | Ese presupuesto ya fue ingerido antes; usar PATCH si quieres actualizarlo. |
| 422 | Validación de campos fallida | Response incluye `errors[]` con el path de cada campo inválido. |
| 429 | Rate limit excedido | Esperar y reintentar. Rate limit default: **60 req/min por key**. Header `Retry-After` indica segundos. |
| 500 | Error del servidor | Reintentar con backoff exponencial. Contactar soporte si persiste. |

### Ejemplo — curl

```bash
curl -X POST https://api.<nuestro-dominio>.com/v1/budgets \
  -H "X-API-Key: artf_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "external_id":"chatbot-abc-001",
    "client_name":"María García",
    "client_email":"maria@acme.com",
    "service_type":"Chatbot WhatsApp",
    "description":"...",
    "estimated_amount":"5000.00",
    "source":"whatsapp"
  }'
```

### Ejemplo — Python

```python
import httpx

client = httpx.Client(
    base_url="https://api.<nuestro-dominio>.com/v1",
    headers={"X-API-Key": os.environ["ARTIFICIALIC_BUDGET_KEY"]},
    timeout=20.0,
)

def enviar_presupuesto(payload: dict) -> dict:
    r = client.post("/budgets", json=payload)
    if r.status_code == 409:
        # ya existe, no reintentar
        return {"status": "duplicate", "existing_id": r.json().get("detail")}
    r.raise_for_status()
    return r.json()

enviar_presupuesto({
    "external_id": "chatbot-abc-001",
    "client_name": "María García",
    "client_email": "maria@acme.com",
    "service_type": "Chatbot WhatsApp",
    "description": "...",
    "estimated_amount": "5000.00",
    "source": "whatsapp",
})
```

### Ejemplo — Node.js (fetch)

```js
const res = await fetch("https://api.<nuestro-dominio>.com/v1/budgets", {
  method: "POST",
  headers: {
    "X-API-Key": process.env.ARTIFICIALIC_BUDGET_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    external_id: "chatbot-abc-001",
    client_name: "María García",
    client_email: "maria@acme.com",
    service_type: "Chatbot WhatsApp",
    description: "...",
    estimated_amount: "5000.00",
    source: "whatsapp",
  }),
});
if (res.status === 429) { /* esperar Retry-After */ }
const budget = await res.json();
```

### Retry logic recomendada

- **429 / 5xx:** exponential backoff (1s, 2s, 4s, 8s) hasta 5 intentos.
- **4xx (excepto 429):** NO reintentar — el error está en tu request.
- Usar `external_id` idempotente para no duplicar (ej: prefijo + timestamp + hash).

### Health check

```
GET /v1/ping        → {"status":"ok"}    (sin auth)
GET /v1/me          → info de tu API key  (útil para debugging)
```

---

## Endpoints del dashboard (referencia interna)

*Solo necesario para el equipo que opera el dashboard. Artificialic no los consume.*

- `GET /v1/budgets?status=&priority=&source=&search=&page=&limit=` (scope `budgets:read`)
- `GET /v1/budgets/{id}` (scope `budgets:read`)
- `PATCH /v1/budgets/{id}` (scope `budgets:update`) — status, priority, assigned_to. Requiere `reason` para mover a `cancelado`/`rechazado`.
- `POST /v1/budgets/{id}/notes` (scope `budgets:update`)
- `GET /v1/analytics/stats?date_range=today|7d|30d|year|custom` (scope `budgets:read`)
- `GET|POST|DELETE /v1/admin/api-keys` + `POST /v1/admin/api-keys/{id}/rotate` (scope `admin`)

Ver spec completo en `/docs` (Swagger UI).

---

## Scopes disponibles

| Scope | Para qué sirve | Dueño típico |
|---|---|---|
| `budgets:write` | Crear presupuestos (ingest) | Chatbots de Artificialic |
| `budgets:read` | Listar, ver detalle, analytics | Dashboard |
| `budgets:update` | Cambiar estado, prioridad, notas | Dashboard |
| `admin` | CRUD de API Keys | Super-admin |

**Best practice:** emitir keys con el scope **mínimo** necesario. Una key para Artificialic tiene solo `budgets:write` — si se filtra, el atacante puede crear presupuestos falsos pero no leer/borrar los existentes.

---

## Rotación de keys sin downtime

1. `POST /v1/admin/api-keys/{id}/rotate` → devuelve la nueva key plaintext (una sola vez).
2. La key vieja queda activa con `expires_at = ahora + 7 días`.
3. Se entrega la nueva key a Artificialic para que actualicen sus secrets.
4. Durante 7 días, ambas keys funcionan. Tras ese plazo, la vieja expira.

---

## Tests

```bash
pytest tests/ -v     # 53 tests (API keys, ingest, dashboard, analytics, seed)
```

---

## Variables de entorno

| Variable | Default dev | Producción (Railway) |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./artificialic.db` | `postgresql+psycopg://...@ep-xxx.neon.tech/...?sslmode=require` |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | `https://<tu-dashboard>.vercel.app` |
| `RATE_LIMIT_DEFAULT` | `60` | `60` (ajustable por key en DB) |
| `BOOTSTRAP_ADMIN_ON_EMPTY` | `true` | `true` en primer deploy, `false` después |
| `ENABLE_DOCS` | `true` | `false` (ocultar Swagger en prod) |
| `ENVIRONMENT` | `development` | `production` |

---

## Estructura del código

```
app/
├── main.py               FastAPI app, CORS, rate limiter, exception handlers, routers
├── core/
│   ├── config.py         Settings (pydantic-settings desde .env)
│   ├── security.py       Generación/hashing de tokens (SHA-256 + HMAC timing-safe)
│   ├── dependencies.py   get_api_key + require_scopes
│   └── logging_filter.py Redacción de X-API-Key y patrones artf_* en logs
├── db/
│   ├── base.py · session.py · seed.py
├── models/               SQLAlchemy: api_key, budget, note, status_change
├── schemas/              Pydantic v2: api_key, budget, analytics
├── routes/
│   ├── ingest.py         POST /v1/budgets (Artificialic)
│   ├── dashboard.py      GET/PATCH /v1/budgets, notes (dashboard)
│   ├── analytics.py      GET /v1/analytics/stats
│   ├── admin.py          CRUD de API Keys
│   └── meta.py           /v1/ping, /v1/me
└── services/             api_key_service, budget_service, analytics_service, status_machine
```

---

## Exportar OpenAPI spec

```bash
python -c "import json; from app.main import app; print(json.dumps(app.openapi(), indent=2))" > docs/openapi.json
```

Útil para generar clientes o compartir spec con integradores.
