# Artificialic Budget Platform

> **Plataforma llave en mano para el cliente Artificialic** (artificialic.com).
> Backend REST que provee la API + Dashboard React para la gestión interna de los presupuestos que generan los chatbots IA de Artificialic.

## Arquitectura

```
┌────────────────────┐           ┌──────────────────────┐           ┌────────────────────┐
│  Chatbots IA de    │  POST     │  NUESTRO backend     │   GET     │  Dashboard admin   │
│  Artificialic      │ /budgets  │  FastAPI + API Keys  │ /budgets  │  (equipo interno   │
│  (WhatsApp, Web…)  │ ───────▶  │  + DB (Neon prod)    │ ◀────────  │   de Artificialic) │
└────────────────────┘ X-API-Key └──────────────────────┘ X-API-Key └────────────────────┘
                                            │
                                            ▼
                                  ┌─────────────────┐
                                  │ SQLite (dev)    │
                                  │ Postgres (prod) │
                                  └─────────────────┘
```

**Nosotros proveemos la API.** Artificialic es consumer — sus chatbots autentican con una API Key de scope `budgets:write` que les entregamos desde el dashboard.

## Estructura del repo

```
posible cliente/
├── ARTIFICIALIC_DASHBOARD_CONTEXT.md   Spec maestro Spec-Driven Development (SC-000…SC-006 + deploy)
├── cotizaciones.md                      Referencia histórica arquitectura CJDG V2.1
├── logo.webp                            Logo original 32x32 (hay versión vectorizada en dashboard/public/)
├── api/                                 Backend FastAPI + SQLAlchemy + Pydantic
│   ├── app/                             Código (models, schemas, routes, services, core)
│   ├── tests/                           53 tests pytest (API Keys, ingest, dashboard, analytics, seed)
│   ├── cli.py                           create-key · list-keys · revoke-key · seed
│   ├── docs/openapi.json                OpenAPI spec exportado
│   ├── Dockerfile · docker-compose.yml  Para deploy a Railway
│   └── README.md                        **Integration Guide para Artificialic**
└── dashboard/                           Frontend React + TS + Vite
    ├── src/                             api, hooks, components (layout/budgets/shared), pages, lib
    ├── public/artificialic-logo.svg     Logo vectorizado con gradiente de marca
    └── README.md                        Setup + rutas + paleta + deploy Vercel
```

## Quickstart local (5 minutos)

**Terminal 1 — Backend:**
```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python cli.py seed --reset           # crea 40 budgets + 3 API keys demo
# → copia la key "Dashboard Admin (demo)"
uvicorn app.main:app --reload        # http://localhost:8000
```

**Terminal 2 — Frontend:**
```bash
cd dashboard
npm install
cp .env.example .env
npm run dev                          # http://localhost:5173
```

**Browser:**
1. `http://localhost:5173` → **Configuración** → pegar la admin key → **Guardar y probar**.
2. Ir a **Presupuestos** → ver los 40 budgets seed, filtrar, cambiar a Kanban, click en un row.
3. Ir a **Analytics** → KPIs y 4 charts poblados.
4. Volver a **Configuración → API Keys** → generar una nueva key con scope `budgets:write` → esa se la entregas a Artificialic.

## Tests

```bash
cd api && pytest tests/          # 53 backend tests
cd dashboard && npm run build    # typecheck + bundle
```

## Deploy producción

Stack: **Neon (DB serverless) + Railway (backend) + Vercel (frontend)**. Ver sección 13 completa en `ARTIFICIALIC_DASHBOARD_CONTEXT.md`.

1. **Neon** — crear proyecto, copiar `postgresql+psycopg://...@ep-xxx.neon.tech/...?sslmode=require`.
2. **Railway** — importar repo, apuntar a `api/`, setear env `DATABASE_URL`, `CORS_ORIGINS`, `BOOTSTRAP_ADMIN_ON_EMPTY=true` (primer deploy).
3. **Vercel** — importar repo, Root Directory = `dashboard/`, env `VITE_API_URL` = URL de Railway.
4. Añadir la URL final de Vercel al `CORS_ORIGINS` de Railway.
5. `railway run python cli.py list-keys` → copiar admin key → pegarla en el dashboard.
6. Cambiar `BOOTSTRAP_ADMIN_ON_EMPTY=false` en Railway.

Costo estimado demo: **~$5/mes** (Railway Hobby). Neon free tier + Vercel free tier.

## Entrega a Artificialic

1. Desde el dashboard: **Configuración → API Keys → Nueva Key** con scope `budgets:write`.
2. Copiar el plaintext (se muestra una sola vez) y entregar por canal seguro (1Password, Bitwarden, email cifrado).
3. Compartir `api/README.md` (Integration Guide) con ejemplos curl/Python/Node.
4. Rate limit default 60 req/min — ajustable por key si necesitan más.

## Desarrollo (Spec-Driven)

Reglas activas (ver sección 11 del spec):
- **Spec primero, código después.** Cambios se reflejan en el contexto maestro antes de codear.
- **Un SC = una unidad de entrega.** No mezclar lógica de SC-002 con SC-004 en un commit.
- **API Contract como fuente de verdad.** Cambios de endpoint/schema → actualizar sección 2 del maestro antes.
- **Mobile-first responsive.** 375 → 768 → 1440.

Los sub-contextos (SC-000 Backend/API Keys, SC-001 Layout, SC-002 Lista, SC-003 Detalle, SC-004 Analytics, SC-005 API Client, SC-006 Settings) están en [`ARTIFICIALIC_DASHBOARD_CONTEXT.md`](./ARTIFICIALIC_DASHBOARD_CONTEXT.md).

---

*Proyecto construido con Spec-Driven Development. Entregable completo para cerrar a Artificialic como cliente.*
