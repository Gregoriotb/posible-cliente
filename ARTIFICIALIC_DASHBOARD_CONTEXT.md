# 🎯 PROYECTO: Artificialic Budget Platform
## Spec-Driven Development — Contexto Maestro + Sub-contextos + Skills

> **Estado:** actualizado 2026-04-23 con arquitectura correcta (NOSOTROS proveemos la API; Artificialic es consumer).

---

## 1. CONTEXTO MAESTRO (Master Context)

### 1.1 Visión del Producto
**Nombre clave interno:** `artificialic-budget-platform`
**Cliente:** Artificialic (artificialic.com) — Plataforma de automatización empresarial con IA.
**Propósito:** Plataforma con dos superficies que entregamos llave en mano:
1. **Backend REST API** (propio nuestro) donde los chatbots IA de Artificialic envían los presupuestos que generan.
2. **Dashboard administrativo** (interno del equipo de Artificialic) que visualiza, gestiona y cambia el estado de cada presupuesto.

**Arquitectura:**
```
┌────────────────────┐          ┌───────────────────┐         ┌────────────────────┐
│  Chatbots IA de    │  POST    │  NUESTRO backend  │   GET   │  Dashboard admin   │
│  Artificialic      │ /budgets │  FastAPI + DB     │ /budgets│  (equipo interno   │
│  (WhatsApp, Web…)  │ ───────▶ │  + API Keys       │ ◀────── │   de Artificialic) │
└────────────────────┘ X-API-Key└───────────────────┘ X-API-Key└────────────────────┘
                                        │
                                        ▼
                              ┌───────────────────┐
                              │   SQLite/Postgres │
                              │   + audit trail   │
                              └───────────────────┘
```

### 1.2 Diferencia vs CJDG V2.1
CJDG V2.1 era **chat-cotizaciones bidireccional Cliente↔Admin** con WebSocket realtime consumido por un único frontend monolítico. Este proyecto es distinto en tres dimensiones:
- **API pública multi-consumer** con sistema de API Keys estilo Stripe/SendGrid. Pensada para que terceros (chatbots de Artificialic, futuros integradores) la consuman.
- **Sin chat**: flujo unidireccional `chatbot → API → DB → dashboard`. Los clientes finales no interactúan con el dashboard.
- **Backend + Frontend propios**: entregamos las dos piezas, no solo un frontend conectado a algo externo.

### 1.3 Stack Tecnológico
| Capa | Tecnología | Nota |
|------|------------|------|
| Backend | **FastAPI (Python 3.11+)** | Propio. Provee la API REST. |
| DB local dev | SQLite | Archivo `artificialic.db`, sin config. |
| DB producción | **Neon** (Postgres serverless) | Scale-to-zero, branching por PR, connection pooling. Swap con `DATABASE_URL=postgresql+psycopg://...@ep-xxx.neon.tech/...`. |
| Driver Postgres | `psycopg[binary]` v3 | Añadido a `requirements.txt` cuando se activa Neon. |
| ORM + Migrations | SQLAlchemy 2.0 + Alembic | |
| Validación | Pydantic v2 | Request/response schemas. |
| Rate limit | slowapi (in-memory) | 60 req/min por key default. Backend persistente en Railway, single-worker → in-memory es suficiente. Swap a Redis si se escala a multi-worker. |
| Token gen | `secrets.token_urlsafe(48)` + SHA-256 | Ver SC-000. |
| Server | uvicorn (ASGI) | |
| Frontend | React 18 + TypeScript + Vite | SPA que consume **nuestro** backend. |
| Estilos | Tailwind CSS + shadcn/ui | |
| Estado remoto | TanStack Query v5 | Caché + invalidación + optimistic updates. |
| Gráficos | Recharts | |
| Drag & drop | @dnd-kit | Kanban de presupuestos. |
| Auth API | **Sistema propio de API Keys** con scopes | Header `X-API-Key: artf_live_<48chars>` |
| **Deploy** | **Backend: Railway (Docker) · Frontend: Vercel · DB: Neon** | Stack completo serverless-friendly con tier gratis / bajo costo. Ver sección 13. |

### 1.4 Paleta de Colores — Artificialic Brand
Extraída del sitio [artificialic.com](https://artificialic.com):

```css
/* === PALETA ARTIFICIALIC === */
--ai-primary:      #22C55E;   /* Verde WhatsApp / Principal (acción positiva, éxito) */
--ai-primary-dark: #16A34A;   /* Verde oscuro (hover, active) */
--ai-secondary:    #3B82F6;   /* Azul digital (links, info, estados neutrales) */
--ai-accent:       #8B5CF6;   /* Violeta/Morado (gradientes, highlights) */
--ai-gradient:     linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #22C55E 100%);
--ai-bg:           #FFFFFF;
--ai-surface:      #F8FAFC;
--ai-border:       #E2E8F0;
--ai-text:         #0F172A;
--ai-text-muted:   #64748B;
--ai-danger:       #EF4444;
--ai-warning:      #F59E0B;
--ai-info:         #06B6D4;
```

**Tipografía:** Inter o Geist (sans-serif moderna, legible en dashboards).
**Logo:** `posible cliente/logo.webp` (32x32). Hay que obtener SVG alta res o generar placeholder con gradiente de marca (azul→violeta→verde). Destino final: `dashboard/public/artificialic-logo.svg`. Uso en header con `height: 32px` y clear space mínimo 16px.

### 1.5 Estados del Presupuesto (Máquina de Estados)
```
recibido → en_revision → cotizado → aprobado → en_proceso → completado
    ↓           ↓           ↓          ↓           ↓            ↓
 cancelado   rechazado   negociando  pausado   esperando    facturado
```
**Estados principales (obligatorios en UI):**
- `recibido` — Llegó desde el chatbot, sin revisar
- `en_revision` — Alguien del equipo lo está analizando
- `cotizado` — Se envió propuesta al cliente
- `negociando` — El cliente pidió ajustes
- `aprobado` — Cliente aceptó, listo para ejecutar
- `en_proceso` — Trabajo en curso
- `completado` — Entregado
- `cancelado` — Descartado
- `rechazado` — No procede

---

## 2. MODELO DE DATOS (Contrato API propio)

### 2.1 Entidad Principal: Budget

```typescript
interface Budget {
  id: string;                    // UUID v4
  external_id: string;           // ID en el sistema de Artificialic (idempotencia)
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_company?: string;
  service_type: string;          // Ej: "Chatbot WhatsApp", "Catálogo Inteligente"
  description: string;
  estimated_amount: number;      // Decimal(12,2)
  currency: string;              // "USD" | "EUR" | "MXN"
  status: BudgetStatus;
  priority: "low" | "medium" | "high" | "urgent";
  source: string;                // "whatsapp" | "web" | "messenger" | "email"
  assigned_to?: string;          // Nombre del admin asignado
  tags: string[];
  created_at: string;            // ISO 8601
  updated_at: string;
  due_date?: string;
  created_by_key_id: string;     // UUID — audit trail (qué API key ingresó este budget)
  notes: Note[];
  history: StatusChange[];
}

type BudgetStatus =
  | "recibido" | "en_revision" | "cotizado" | "negociando"
  | "aprobado" | "en_proceso" | "completado"
  | "cancelado" | "rechazado";

interface Note {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

interface StatusChange {
  from: BudgetStatus;
  to: BudgetStatus;
  changed_by: string;
  changed_at: string;
  reason?: string;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;                // primeros 16 chars visibles (nunca el token completo)
  scopes: string[];              // ["budgets:write"] | ["budgets:read","budgets:update"] | ["admin"]
  rate_limit_per_minute: number;
  status: "active" | "revoked";
  last_used_at?: string;
  created_at: string;
  created_by: string;
  expires_at?: string;
}
```

### 2.2 Contrato API (OpenAPI-style)

```yaml
openapi: 3.0.0
info:
  title: Artificialic Budget Platform API
  description: >
    API provista por nosotros. Consumida por:
    (a) chatbots de Artificialic → ingest de presupuestos
    (b) dashboard interno → lectura, gestión, analytics, admin
  version: 1.0.0
servers:
  - url: https://api.<nuestro-dominio>.com/v1
    description: Producción
  - url: http://localhost:8000/v1
    description: Desarrollo
security:
  - ApiKeyAuth: []
paths:

  # === INGEST (Artificialic) — scope: budgets:write ===
  /budgets:
    post:
      summary: Crear presupuesto (ingest desde chatbot)
      x-scopes: [budgets:write]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/BudgetCreate' }
      responses:
        201: { description: Budget creado }
        400: { description: Validación fallida }
        401: { description: API Key inválida o ausente }
        403: { description: Scope insuficiente }
        409: { description: external_id duplicado (idempotencia) }
        429: { description: Rate limit excedido }

    # === LECTURA DASHBOARD — scope: budgets:read ===
    get:
      summary: Listar presupuestos (paginado, filtrable)
      x-scopes: [budgets:read]
      parameters:
        - { name: status,       in: query, schema: { type: string } }
        - { name: priority,     in: query, schema: { type: string } }
        - { name: source,       in: query, schema: { type: string } }
        - { name: assigned_to,  in: query, schema: { type: string } }
        - { name: search,       in: query, schema: { type: string } }
        - { name: page,         in: query, schema: { type: integer, default: 1 } }
        - { name: limit,        in: query, schema: { type: integer, default: 20, maximum: 100 } }
        - { name: sort_by,      in: query, schema: { type: string, default: "created_at" } }
        - { name: sort_order,   in: query, schema: { type: string, enum: [asc, desc], default: desc } }
      responses:
        200:
          description: Lista paginada
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: '#/components/schemas/Budget' } }
                  meta:
                    type: object
                    properties:
                      total: { type: integer }
                      page: { type: integer }
                      limit: { type: integer }
                      total_pages: { type: integer }

  /budgets/{id}:
    get:
      summary: Detalle de presupuesto (incluye notes + history)
      x-scopes: [budgets:read]
    patch:
      summary: Actualizar estado / prioridad / assigned_to
      x-scopes: [budgets:update]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                status: { type: string }
                priority: { type: string }
                assigned_to: { type: string }
                reason: { type: string, description: "Requerido si status transiciona a cancelado/rechazado" }

  /budgets/{id}/notes:
    post:
      summary: Agregar nota interna al presupuesto
      x-scopes: [budgets:update]

  /analytics/stats:
    get:
      summary: Métricas y KPIs del dashboard
      x-scopes: [budgets:read]
      parameters:
        - name: date_range
          in: query
          schema: { type: string, enum: [today, 7d, 30d, year, custom] }
        - name: start
          in: query
          schema: { type: string, format: date }
        - name: end
          in: query
          schema: { type: string, format: date }

  # === ADMIN (gestión de API Keys) — scope: admin ===
  /admin/api-keys:
    get:
      summary: Listar API Keys (sin plaintext)
      x-scopes: [admin]
    post:
      summary: Crear API Key. Devuelve plaintext UNA sola vez.
      x-scopes: [admin]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [name, scopes]
              properties:
                name: { type: string, example: "Artificialic Production" }
                scopes:
                  type: array
                  items: { type: string, enum: [budgets:write, budgets:read, budgets:update, admin] }
                rate_limit_per_minute: { type: integer, default: 60 }
                expires_at: { type: string, format: date-time, nullable: true }
      responses:
        201:
          description: Creada. El campo `key` (plaintext) solo aparece aquí.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ApiKey'
                  - type: object
                    properties:
                      key: { type: string, example: "artf_live_aB3kX9pQ..." }

  /admin/api-keys/{id}:
    delete:
      summary: Revocar (soft delete)
      x-scopes: [admin]

  /admin/api-keys/{id}/rotate:
    post:
      summary: Rotar. Nueva key ahora; vieja expira en 7 días.
      x-scopes: [admin]

  # === META ===
  /ping:
    get:
      summary: Health check (sin auth)
      security: []
  /me:
    get:
      summary: Info de la API Key actual (útil para debugging)
      x-scopes: []   # cualquier key válida

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
      description: "Formato `artf_live_<48 chars url-safe>`. Obtener desde dashboard admin."
  schemas:
    BudgetCreate:
      type: object
      required: [external_id, client_name, client_email, service_type, description, estimated_amount, source]
      properties:
        external_id: { type: string, description: "ID en sistema de Artificialic. Clave de idempotencia." }
        client_name: { type: string }
        client_email: { type: string, format: email }
        client_phone: { type: string, nullable: true }
        client_company: { type: string, nullable: true }
        service_type: { type: string }
        description: { type: string }
        estimated_amount: { type: number, format: decimal, minimum: 0.01 }
        currency: { type: string, default: "USD" }
        priority: { type: string, enum: [low, medium, high, urgent], default: medium }
        source: { type: string, enum: [whatsapp, web, messenger, email] }
        tags: { type: array, items: { type: string }, default: [] }
        due_date: { type: string, format: date-time, nullable: true }
    Budget: { description: "(ver sección 2.1)" }
    ApiKey: { description: "(ver sección 2.1)" }
```

### 2.3 Scopes del sistema

| Scope | Uso | Típico dueño |
|---|---|---|
| `budgets:write` | Crear presupuestos vía ingest | Chatbots de Artificialic |
| `budgets:read` | Leer presupuestos y analytics | Dashboard |
| `budgets:update` | Modificar estado, prioridad, notas | Dashboard |
| `admin` | Gestionar API Keys (CRUD) | Super-admin |

---

## 3. SUB-CONTEXTO 0: BACKEND API & KEY MANAGEMENT (SC-000)

### Scope
Backend FastAPI completo: modelos, endpoints, sistema de API Keys, rate limiting, seguridad, CLI, tests.

### Estructura de archivos
```
api/
├── app/
│   ├── main.py               # FastAPI app, CORS, rate limiter, routers, exception handlers
│   ├── core/
│   │   ├── config.py         # pydantic-settings (env vars)
│   │   ├── security.py       # generate_token, hash_token, verify_token (timing-safe)
│   │   └── dependencies.py   # get_api_key, require_scopes
│   ├── db/
│   │   ├── base.py           # Declarative Base
│   │   ├── session.py        # engine + get_db generator
│   │   └── seed.py           # data demo para desarrollo
│   ├── models/
│   │   ├── api_key.py
│   │   ├── budget.py
│   │   ├── note.py
│   │   └── status_change.py
│   ├── schemas/              # Pydantic v2
│   ├── routes/
│   │   ├── ingest.py         # POST /v1/budgets (Artificialic)
│   │   ├── dashboard.py      # GET /v1/budgets, GET /:id, PATCH, notes (dashboard)
│   │   ├── analytics.py      # GET /v1/analytics/stats
│   │   ├── admin.py          # CRUD de API Keys
│   │   └── meta.py           # /v1/ping, /v1/me
│   └── services/
│       ├── api_key_service.py
│       └── budget_service.py
├── alembic/                  # migraciones
├── tests/
├── cli.py                    # python -m app.cli create-key|list-keys|revoke|seed
├── requirements.txt
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── README.md                 # Integration Guide para Artificialic
```

### Diseño de API Keys
- **Formato:** `artf_live_<48 chars url-safe>`. Prefijo visible facilita identificación en logs.
- **Generación:** `secrets.token_urlsafe(48)` (cryptographically secure).
- **Almacenamiento:** SHA-256 hash en columna `hash` (indexada). Plaintext jamás persistido después del response de create.
- **Prefix visible:** primeros 16 chars (`artf_live_` + 6 del random), guardados sin hash para mostrar en UI admin.
- **Scopes:** JSON array, granulares (ver sección 2.3).
- **Rate limit:** por key, configurable. Default 60/min.
- **Bootstrap:** si al startup no hay keys con scope `admin`, el sistema crea una y la imprime en stdout + escribe `ADMIN_KEY.txt` (chmod 600). Controlable con env `BOOTSTRAP_ADMIN_ON_EMPTY`.
- **Rotación:** `POST /v1/admin/api-keys/:id/rotate` genera nueva key; la vieja entra en `expires_at = now + 7d` para permitir migración del consumer sin downtime.

### Seguridad (checklist mínimo)
- [x] SHA-256 hashing + `hmac.compare_digest` (timing-safe)
- [x] Rate limit por key (slowapi in-memory; swap Redis en prod)
- [x] CORS whitelist estricta (dashboard origin + localhost dev)
- [x] Request validation Pydantic (limita DoS por payload)
- [x] Exception handler global: nunca devuelve stack traces al cliente
- [x] Audit trail: `api_keys.last_used_at`, `budgets.created_by_key_id`
- [x] Logging middleware redacta `X-API-Key` y patrones `artf_*`
- [x] UUIDs v4 en IDs (no enumerables)
- [x] Soft-delete de keys (status=revoked), nunca hard delete
- [x] Validación estricta de scopes en cada endpoint con `require_scopes`
- [x] Idempotencia en POST /v1/budgets vía `external_id` (409 si duplicado)
- [x] Opcional futuro: whitelist de IPs por key, `expires_at`

### Componentes clave
```python
# core/security.py
def generate_token(prefix: str = "artf_live_") -> tuple[str, str, str]:
    """Genera token. Retorna (plaintext, sha256_hash, visible_prefix)."""

def verify_token(plaintext: str, stored_hash: str) -> bool:
    """hmac.compare_digest para timing-safe."""

# core/dependencies.py
async def get_api_key(x_api_key: str = Header(...), db = Depends(get_db)) -> ApiKey:
    """Lookup por hash, verifica status/expires, actualiza last_used_at."""

def require_scopes(*scopes: str):
    """Dependency factory: 403 si key no tiene los scopes requeridos."""

# services/api_key_service.py
def create(db, name, scopes, rate_limit, expires_at=None) -> dict:
    """Returns dict con `key` plaintext (único momento en que aparece)."""

def revoke(db, key_id): ...
def rotate(db, key_id) -> dict:
    """Nueva key + marca vieja con expires_at = now + 7d."""
```

### Reglas de diseño
- **Nunca** log del plaintext (ni en DEBUG ni en stack traces).
- **Nunca** devolver plaintext en GET (solo POST create / rotate).
- **Siempre** verificar scopes con `require_scopes` en cada endpoint protegido.
- **Siempre** actualizar `last_used_at` en cada request autenticada (task en background para no bloquear).
- Bootstrap automático solo si `BOOTSTRAP_ADMIN_ON_EMPTY=true`; en prod: `false` + provisionar manualmente vía CLI.

### Tests mínimos
- Creación de keys con cada combinación de scopes.
- Listado no expone plaintext.
- Revoke deja status=revoked, siguientes requests 401.
- Rotate crea nueva, vieja sigue activa hasta expires_at.
- Scope mismatch → 403.
- Rate limit → 429 tras N requests.
- `ingest` con key de scope wrong → 403.
- `external_id` duplicado → 409.

---

## 4. SUB-CONTEXTO 1: DASHBOARD LAYOUT & NAVEGACIÓN (SC-001)

### Scope
Estructura visual principal, sidebar, header, sistema de navegación.

### Especificaciones
- **Layout:** Sidebar colapsable izquierda (240px expandido, 64px colapsado) + contenido principal.
- **Header:** Fijo arriba, 64px de alto. Logo Artificialic a la izquierda. Notificaciones + perfil de usuario a la derecha.
- **Sidebar Items:**
  1. Dashboard (icono: LayoutDashboard)
  2. Presupuestos (icono: FileText) — badge con count de "recibido"
  3. Analytics (icono: BarChart3)
  4. Configuración (icono: Settings)
- **Responsive:** En móvil (<768px), sidebar se convierte en drawer con overlay oscuro.
- **Tema:** Modo claro por defecto. Toggle de modo oscuro en settings.
- **Colores aplicados:**
  - Sidebar bg: `bg-white` con borde derecho `border-ai-border`
  - Item activo: `bg-ai-primary/10 text-ai-primary` con indicador izquierdo 3px `bg-ai-primary`
  - Item hover: `bg-ai-surface`
  - Header: `bg-white/80 backdrop-blur-md border-b border-ai-border`

### Componentes clave
```
AppLayout.tsx · Sidebar.tsx · Header.tsx · MobileDrawer.tsx
```

### Reglas
- `lucide-react` para todos los iconos.
- Logo vía `<img src="/artificialic-logo.svg" />` en `dashboard/public/`.
- Transiciones: `transition-all duration-200 ease-in-out`.
- Z-index: Header z-40, Sidebar z-30, Drawer z-50.

---

## 5. SUB-CONTEXTO 2: LISTA DE PRESUPUESTOS (SC-002)

### Scope
Vista principal tipo tabla/kanban con filtros, búsqueda y acciones rápidas.

### Especificaciones
- **Vista por defecto:** Tabla con columnas:
  - Checkbox (selección múltiple)
  - Cliente (nombre + empresa + avatar placeholder)
  - Servicio (badge)
  - Monto (formateado con `Intl.NumberFormat`)
  - Estado (badge con color del estado)
  - Prioridad
  - Fuente (icono)
  - Fecha relativa (`hace 2 horas` con date-fns)
  - Asignado a
  - Acciones (dropdown: Ver, Editar, Cambiar estado, Agregar nota)
- **Vista alternativa:** Kanban con drag-and-drop (`@dnd-kit/core`), columnas por estado.
- **Filtros sticky:** búsqueda, multi-select estado, prioridad, fuente, asignado, rango fechas, botón limpiar.
- **Paginación:** Infinite scroll preferido (`useInfiniteQuery`). Fallback a paginación numérica.
- **Empty state:** Ilustración + texto + botón "Limpiar filtros".
- **Loading:** `<Skeleton>` de shadcn, nunca spinner pantalla completa.
- **Responsive:** Bajo 768px la tabla se convierte en cards apiladas.

### Colores por estado
```
recibido:    bg-slate-100 text-slate-700 border-slate-200
en_revision: bg-blue-50 text-blue-700 border-blue-200
cotizado:    bg-purple-50 text-purple-700 border-purple-200
negociando:  bg-amber-50 text-amber-700 border-amber-200
aprobado:    bg-emerald-50 text-emerald-700 border-emerald-200
en_proceso:  bg-cyan-50 text-cyan-700 border-cyan-200
completado:  bg-green-50 text-green-700 border-green-200
cancelado:   bg-red-50 text-red-700 border-red-200
rechazado:   bg-gray-50 text-gray-700 border-gray-200
```

### Componentes clave
```
BudgetListPage · BudgetTable · BudgetKanban · BudgetFilters · BudgetCard
StatusBadge · PriorityBadge · SourceIcon · BudgetActionsMenu
```

### API Integration
```typescript
const { data, fetchNextPage, hasNextPage, isLoading } = useBudgets({
  status, priority, source, assigned_to, search, sort_by, sort_order
});
```

---

## 6. SUB-CONTEXTO 3: DETALLE DE PRESUPUESTO (SC-003)

### Scope
Slide-over (o página) con toda la información de un presupuesto.

### Especificaciones
- **Layout:** Sheet de shadcn desde la derecha (640px desktop, full-screen móvil) abierto con URL state (`?budget=<id>`).
- **Secciones:**
  1. **Header:** Cliente + botón cerrar + acciones (Editar, Cambiar estado, Asignar)
  2. **Info General:** Grid 2 col (cliente, servicio, monto, fuente, fechas)
  3. **Estado actual:** Timeline vertical con historial de estados
  4. **Notas internas:** Lista + form para agregar
  5. **Actividad:** Feed cronológico (cambios de estado, notas, asignaciones)
- **Cambio de estado:** Dropdown con transiciones válidas desde estado actual (helper en `lib/statusHelpers.ts`). Modal para "razón" (requerida en cancelado/rechazado).
- **Asignación:** Autocomplete de miembros del equipo.

### Componentes clave
```
BudgetDetailSlideOver · StatusTimeline · NotesSection · ActivityFeed
StatusChangeModal · AssignMemberAutocomplete
```

---

## 7. SUB-CONTEXTO 4: ANALYTICS & KPIs (SC-004)

### Scope
Dashboard de métricas con gráficos y estadísticas.

### Especificaciones
- **KPI Cards (top row):**
  - Total Presupuestos (periodo actual vs anterior, delta %)
  - Tasa de Conversión (aprobados / total)
  - Tiempo Promedio de Respuesta (horas)
  - Ingresos Potenciales (suma de aprobados + en_proceso)
- **Gráficos:**
  - **Por estado:** Donut (Recharts PieChart)
  - **Por fuente:** Bar horizontal
  - **Tendencia temporal:** Line chart (recibidos vs aprobados)
  - **Top servicios:** Bar vertical
  - **Rendimiento por asignado:** Bar horizontal
- **Filtros de fecha:** Hoy, 7d, 30d, Año, Custom.
- **Colores:** paleta Artificialic (verde primario, azul secundario, violeta acento).
- **Responsive:** Grid 2x2 → stack vertical bajo 1024px.

### Componentes clave
```
AnalyticsPage · KpiCard · StatusDonutChart · SourceBarChart
TrendLineChart · TopServicesChart · PerformanceByMemberChart · DateRangeFilter
```

---

## 8. SUB-CONTEXTO 5: API CLIENT DEL DASHBOARD (SC-005)

### Scope
Cliente HTTP del dashboard React que consume **NUESTRO** backend. No es un conector a API externa.

### Especificaciones
- **Base URL:** `http://localhost:8000/v1` en dev, `https://api.<nuestro-dominio>.com/v1` en prod. Configurable con `VITE_API_URL`.
- **Auth:** admin-scoped API Key almacenada en localStorage (`artf_admin_key`), enviada como `X-API-Key`.
- **Cliente:** Axios con instancia configurada.
- **Interceptor request:** inyectar `X-API-Key` + `Content-Type: application/json`.
- **Interceptor response:**
  - 401 → limpiar localStorage, redirigir a `/settings` con banner "API Key inválida"
  - 403 → toast "Permisos insuficientes (scope requerido)"
  - 429 → toast "Rate limit, retry-after: Ns" + retry con backoff
  - 500 → toast "Error del servidor" (sin stack trace)
- **Tipado:** TODO tipado con TS. Nunca `any`.
- **Loading:** Skeletons, nunca spinner pantalla completa.

### Estructura
```
dashboard/src/
├── api/
│   ├── client.ts
│   ├── budgets.ts
│   ├── analytics.ts
│   ├── admin.ts       (listKeys, createKey, revokeKey, rotateKey)
│   └── types.ts
└── hooks/
    ├── useBudgets.ts · useBudgetDetail.ts · useUpdateBudget.ts
    ├── useAnalytics.ts · useAdminKeys.ts · useApiKey.ts (localStorage)
```

---

## 9. SUB-CONTEXTO 6: CONFIGURACIÓN & SETTINGS (SC-006)

### Scope
Página de configuración con tres responsabilidades: (a) mostrar info de la sesión activa + logout, (b) **gestionar API Keys de consumers** (las que entregamos a Artificialic), (c) preferencias UI.

### Auth del dashboard — login tradicional
El dashboard se autentica con **usuario y contraseña**, no pegando una API key manualmente. Flujo:

1. `/login` → formulario con `username` + `password`.
2. `POST /v1/auth/login` en el backend valida credenciales contra env vars (`ADMIN_USERNAME` + `ADMIN_PASSWORD`, comparación timing-safe con `hmac.compare_digest`, rate limit 5/min).
3. En 200 OK, el backend devuelve el plaintext de `ADMIN_API_KEY` (env var) + el username.
4. El frontend lo guarda en localStorage (`artf_admin_key`) como antes — el resto del dashboard sigue funcionando igual con X-API-Key en cada request.
5. Logout: limpia localStorage + redirige a `/login`.
6. 401 global en cualquier request → limpia sesión y redirige a login.

**Ventajas vs paste-key:**
- El usuario final jamás ve ni toca el plaintext de la key.
- Credenciales en env vars encriptadas at rest en Railway.
- Rotación de admin key = cambiar env var + redeploy (ni tocar el navegador).
- Password débil toleraable en demo; rate limit 5/min mitiga brute force.

**Seguridad:** mensaje de error idéntico para "usuario equivocado" y "contraseña equivocada" (no leak de qué campo falló). Si las 3 env vars no están seteadas en el backend, `POST /v1/auth/login` devuelve `503` con mensaje claro.

### Especificaciones
- **Tab 1: Mi Conexión**
  - Info de la sesión activa (nombre de la cuenta, scopes, rate limit, último uso).
  - Botón de **cerrar sesión**.
- **Tab 2: API Keys** (visible solo si scope `admin` detectado)
  - Lista de keys: name, prefix (`artf_live_abc123...`), scopes (chips), last_used_at, status, acciones (Revocar, Rotar).
  - Botón "Nueva Key" → modal con form (name, scopes checkboxes, rate_limit, expires_at opcional).
  - Al crear → modal muestra el plaintext UNA VEZ con botón "Copiar" + warning "Guárdelo ahora, no podremos recuperarlo".
- **Tab 3: Preferencias**
  - Tema: Claro / Oscuro / Sistema
  - Moneda por defecto: USD / EUR / MXN
  - Zona horaria
  - Toggles de notificaciones
- **Tab 4: About**
  - Versión, link a artificialic.com, changelog, créditos.

### Componentes clave
```
SettingsPage · ApiKeyForm · ApiKeysList · CreateApiKeyModal
RevokeKeyDialog · RotateKeyDialog · ThemeSelector · CurrencySelector
NotificationToggles
```

---

## 10. SKILLS (Habilidades del Agente)

### Skill 0: FastAPI + SQLAlchemy 2.0 + Pydantic v2
- Endpoints REST con validación estricta request/response.
- Modelos SQLAlchemy con relationships, cascade, indexes.
- Migraciones Alembic auto + manuales.
- Dependencies y sub-dependencies para auth/scopes.
- Exception handlers globales sin info leakage.

### Skill 0.5: API Security Engineering
- API Keys estilo Stripe: hash-only storage, plaintext one-time, prefix visible.
- Rate limiting con slowapi, compound keys (IP + API key id).
- CORS restrictivo, timing-safe comparison (`hmac.compare_digest`).
- Audit logging con redacción de secrets.
- Rotación y expiración de keys sin downtime.

### Skill 1: React + TypeScript Architecture
- Componentes funcionales con hooks personalizados.
- Separar lógica de presentación (container/presentational).
- Tipar props con interfaces, nunca `any`.
- `forwardRef` cuando se requiera.

### Skill 2: Tailwind CSS + shadcn/ui
- Clases utilitarias, evitar CSS modules o styled-components.
- Extender componentes shadcn.
- Sistema de diseño de Artificialic en `tailwind.config.ts`.

### Skill 3: TanStack Query
- `staleTime` y `gcTime` apropiados.
- `useMutation` con invalidación selectiva.
- Optimistic updates para cambios de estado.
- Loading y error states graceful.

### Skill 4: Data Visualization
- Recharts con `ResponsiveContainer`.
- Tooltips custom con formato moneda/fechas.
- Leyendas claras y accesibles.

### Skill 5: API Integration Patterns
- Consumir REST con API Key auth.
- Paginación offset o cursor.
- Retry con backoff, debounce en búsquedas.
- Tipado exhaustivo request/response.

### Skill 6: Accessibility (a11y)
- Keyboard-navigable.
- Contraste mínimo 4.5:1.
- Labels, alt, ARIA roles.
- Focus visible.

### Skill 7: Performance
- `React.lazy()` + `Suspense` por ruta.
- Virtualización (`@tanstack/react-virtual`) si >100 items visibles.
- Memoización selectiva.
- Evitar re-renders en tablas y gráficos.

---

## 11. BUENAS PRÁCTICAS — SPEC-DRIVEN DEVELOPMENT

### 11.1 Flujo de Trabajo
1. **Spec primero, código después.** Ningún componente se escribe sin que su SC esté definido y aprobado.
2. **Un SC = una unidad de entrega.** No mezclar lógica de SC-002 (lista) con SC-004 (analytics).
3. **API Contract como fuente de verdad.** El backend define el contrato; el frontend se adapta. Cambios de contrato → actualizar sección 2 del maestro ANTES de tocar código.
4. **Mobile-first responsive.** Diseñar para 375px, escalar a 1440px+.
5. **Docs + memoria siempre al día.** Tras cerrar un SC, validar que el spec lo refleja.

### 11.2 Convenciones de Código
- **Nomenclatura:**
  - Componentes: PascalCase (`BudgetTable.tsx`)
  - Hooks: camelCase prefijo `use` (`useBudgets.ts`)
  - Utilidades: camelCase (`formatCurrency.ts`)
  - Tipos: PascalCase (`Budget`, `BudgetStatus`)
- **Archivos:** un componente por archivo. Hooks en `src/hooks/`. Tipos en `src/api/types.ts`.
- **Imports:** path aliases `@/components`, `@/hooks`, `@/api`.
- **Estado:** local con `useState`. Remoto con TanStack Query. Global con Zustand solo si se necesita (probablemente no).

### 11.3 Manejo de Errores
- **API errors:** toast con mensaje del backend o fallback genérico.
- **404 de presupuesto:** página "Presupuesto no encontrado" con botón volver.
- **API Key inválida (401):** redirigir a /settings con banner.
- **Scope insuficiente (403):** toast explicando.
- **Rate limit (429):** toast + retry backoff.
- **Offline:** detectar `navigator.onLine`, banner amarillo.

### 11.4 Testing
- **Backend:** pytest + TestClient. Mínimo: API Keys CRUD, ingest, dashboard, rate limit, scopes.
- **Frontend (opcional fase demo):** Vitest + RTL + MSW. Utilidades + filtros + forms.

### 11.5 Git & Deploy
- **Branching:** `main` → `feat/sc-XXX-descripcion` → PR → merge.
- **Commits:** Conventional referenciando SC (`feat(SC-002): add kanban`, `fix(SC-000): timing-safe compare`).
- **Deploy:**
  - Backend: Docker → Railway/Render.
  - Frontend: Vercel con preview deployments por PR.
- **Env vars:**
  - Backend: `DATABASE_URL`, `CORS_ORIGINS`, `RATE_LIMIT_DEFAULT`, `BOOTSTRAP_ADMIN_ON_EMPTY`.
  - Frontend: `VITE_API_URL`, `VITE_USE_MOCKS` (opcional dev offline).

---

## 12. CHECKLIST DE ENTREGA

Backend (SC-000):
- [ ] Scaffold FastAPI + SQLite + estructura de carpetas
- [ ] Sistema de API Keys (modelo, security, dependencies, CRUD admin, bootstrap)
- [ ] Modelo Budget + endpoint ingest POST /v1/budgets
- [ ] Endpoints dashboard lectura (GET /budgets, GET /:id)
- [ ] Endpoints dashboard escritura (PATCH, POST /:id/notes)
- [ ] Analytics GET /v1/analytics/stats
- [ ] Seed + CLI (`python -m app.cli create-key|seed|list-keys|revoke`)
- [ ] Tests pytest mínimos (API Keys, ingest, dashboard, rate limit)

Frontend:
- [ ] Scaffold Vite + React + TS + Tailwind + shadcn (SC-005 base)
- [ ] API Client con interceptores (SC-005)
- [ ] Layout + Sidebar + Header + MobileDrawer (SC-001)
- [ ] Lista tabla + Kanban + filtros (SC-002)
- [ ] Detalle slide-over con timeline + notas (SC-003)
- [ ] Analytics con 4 KPIs + 5 charts (SC-004)
- [ ] Settings con gestión de API Keys (SC-006)

Docs:
- [ ] `api/README.md` con Integration Guide completa (curl, Python, Node)
- [ ] `dashboard/README.md` con setup + env vars
- [ ] `README.md` raíz con vista general del monorepo
- [ ] OpenAPI export en `api/docs/openapi.json`

Calidad:
- [ ] Responsive 375px / 768px / 1440px
- [ ] Paleta y logo aplicados consistentemente
- [ ] Manejo de errores y loading states
- [ ] E2E: Simulación de Artificialic mandando budget → aparece en dashboard

---

## 13. DEPLOY STACK (Neon + Railway + Vercel)

### 13.1 Neon (Postgres serverless) — DB
1. Crear proyecto en [neon.tech](https://neon.tech) (tier gratis: 0.5GB, 10 DBs). Región: la más cercana al backend (ej: `aws-us-east-1`).
2. Copiar la connection string. Formato esperado para nuestro driver: `postgresql+psycopg://<user>:<pass>@<endpoint>.neon.tech/<db>?sslmode=require`.
3. Crear una rama (`main` es default; extra: una rama `staging` para previews).
4. En Railway y en local, set `DATABASE_URL` a esa connection string.
5. Ejecutar migraciones: `alembic upgrade head` (una vez por ambiente).
6. Connection pooling: Neon maneja conexiones por default. Si el backend escala verticalmente, activar Pooler endpoint de Neon.

### 13.2 Railway — Backend FastAPI
1. `railway init` dentro de `api/` (o importar repo vía GitHub).
2. El `Dockerfile` ya existente es suficiente — Railway lo detecta.
3. Variables de entorno:
   - `DATABASE_URL` = connection string de Neon
   - `CORS_ORIGINS` = URL final del dashboard en Vercel (ej: `https://artificialic-dashboard.vercel.app`)
   - `ENVIRONMENT=production`
   - `BOOTSTRAP_ADMIN_ON_EMPTY=true` para la primera vez (crea admin key al primer deploy). Luego cambiar a `false` y provisionar keys vía CLI/endpoint admin.
   - `ENABLE_DOCS=false` en prod para ocultar Swagger (opcional).
4. Después del primer deploy: `railway run python cli.py list-keys` → copiar la admin key generada.
5. Añadir dominio personalizado opcional (ej: `api.artificialic.com`).

### 13.3 Vercel — Frontend dashboard
1. `vercel init` o importar desde GitHub apuntando a la subcarpeta `dashboard/`.
2. Framework preset: **Vite**.
3. Build command: `npm run build`. Output: `dist`.
4. Variables de entorno:
   - `VITE_API_URL` = URL de Railway (ej: `https://artificialic-api.up.railway.app/v1` o dominio custom).
5. Deploy → la URL final se agrega a `CORS_ORIGINS` del backend.

### 13.4 Migraciones con Alembic
```bash
# Primera vez (generar baseline desde modelos existentes):
cd api
alembic init alembic
# Editar alembic/env.py para importar Base y conectar a DATABASE_URL
alembic revision --autogenerate -m "initial schema"
alembic upgrade head

# Siguientes cambios:
alembic revision --autogenerate -m "add some field"
alembic upgrade head
```

### 13.5 Flujo end-to-end tras deploy
1. Artificialic recibe su API key (scope `budgets:write`) desde la UI del dashboard (Settings → API Keys → Nueva Key).
2. Sus chatbots hacen `POST https://api.artificialic.com/v1/budgets` con `X-API-Key` → inserción en Neon.
3. Dashboard en Vercel consume `GET /v1/budgets` → muestra los presupuestos al equipo.

### 13.6 Costo estimado (demo / early stage)
- **Neon free tier**: 0.5 GB storage + 190 compute hours/mes → $0 mientras dura la demo.
- **Railway Hobby**: $5/mes (incluye $5 de créditos de compute).
- **Vercel Hobby**: $0 para frontend.
- **Total:** ~$5/mes durante la demo, escalable gradualmente.

---

*Documento generado para Spec-Driven Development del proyecto artificialic-budget-platform.*
*Arquitectura: plataforma propia (backend + dashboard) entregada a Artificialic.*
*Stack de deploy: Neon (DB) + Railway (backend) + Vercel (frontend).*
*Última actualización: 2026-04-23.*
