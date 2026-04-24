# 🚀 Guía de Deploy — Neon + Railway + Vercel

> Instrucciones paso-a-paso para desplegar Artificialic Budget Platform en producción.
> Costo estimado demo: **~$5/mes** (Railway Hobby; Neon y Vercel en free tier).

---

## Resumen del stack

| Pieza | Servicio | URL final típica |
|---|---|---|
| DB | **Neon** (Postgres serverless) | `ep-xxx.us-east-2.aws.neon.tech` |
| Backend | **Railway** (Docker) | `https://artificialic-api.up.railway.app` |
| Frontend | **Vercel** (static) | `https://artificialic-dashboard.vercel.app` |

---

## Paso 1 — Neon (DB)

1. Crear cuenta en [neon.tech](https://neon.tech) (free tier: 0.5 GB + 190h compute/mes).
2. **New Project** → nombre: `artificialic-budget` → región: la más cercana al backend (ej `aws-us-east-2`).
3. En **Dashboard > Connection Details**, activar **"Connection pooling"** (recomendado) y copiar la connection string. Formato crudo que entrega Neon:
   ```
   postgresql://<USER>:<PASSWORD>@ep-<slug>-pooler.<region>.aws.neon.tech/<DB>?sslmode=require&channel_binding=require
   ```
   > **Nota:** el `<region>` que aparece en el hostname puede no coincidir con la región que elegiste en la UI (p.ej. elegiste `us-east-2` y el hostname dice `us-east-1`). Es esperado — Neon asigna el compute pool más cercano disponible. El servicio funciona igual; no lo toques.
4. **Convertir al formato que espera nuestro driver (`psycopg` v3):**
   - Cambiar el prefijo `postgresql://` → `postgresql+psycopg://`
   - Dejar todos los query params (`sslmode=require&channel_binding=require`) intactos — psycopg v3 los soporta.
   - Resultado:
     ```
     postgresql+psycopg://<USER>:<PASSWORD>@ep-<slug>-pooler.<region>.aws.neon.tech/<DB>?sslmode=require&channel_binding=require
     ```
5. **Guardar esta string** — la vas a usar en Railway y localmente para migrar.

### Generar el schema en Neon

Opción A (rápida — usa SQLAlchemy `create_all`):
```bash
cd api
source .venv/bin/activate
DATABASE_URL="postgresql+psycopg://...@ep-xxxx.neon.tech/neondb?sslmode=require" \
  python -c "from app.db.base import Base; from app.db.session import engine; \
             import app.models.api_key, app.models.budget, app.models.note, app.models.status_change; \
             Base.metadata.create_all(engine); print('schema creado')"
```

Opción B (profesional — Alembic, cuando quieras versionar migraciones):
```bash
cd api
alembic init alembic                  # solo la primera vez
# editar alembic/env.py: target_metadata = Base.metadata
alembic revision --autogenerate -m "initial schema"
DATABASE_URL="..." alembic upgrade head
```

### (Opcional) Seedear data demo en Neon

```bash
DATABASE_URL="postgresql+psycopg://...@ep-xxxx.neon.tech/neondb?sslmode=require" \
  python cli.py seed --reset
```
Copiar la key `Dashboard Admin (demo)` que imprime — la vas a usar en el dashboard más adelante.

---

## Paso 2 — Railway (Backend)

1. Crear cuenta en [railway.app](https://railway.app). Hobby plan $5/mes.
2. **New Project → Deploy from GitHub repo** (push antes a un repo privado) **o** `railway init` desde CLI dentro de `api/`.
3. Si lo importas desde GitHub:
   - **Root Directory**: `api/`
   - Railway detecta el `Dockerfile` automáticamente.
4. En el servicio → **Variables** (⚙️ Settings → Variables):

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | la connection string de Neon (paso 1.4) |
   | `CORS_ORIGINS` | *dejar temporal* `http://localhost:5173` — se actualiza al tener la URL de Vercel |
   | `RATE_LIMIT_DEFAULT` | `60` |
   | `BOOTSTRAP_ADMIN_ON_EMPTY` | `true` *(solo primer deploy — cambiar a `false` después)* |
   | `ENABLE_DOCS` | `false` *(oculta Swagger en prod)* |
   | `ENVIRONMENT` | `production` |
   | `PORT` | *automático por Railway* |

5. **Deploy**. Esperar ~2 min el primer build.
6. En **Deployments > Logs** buscar el banner:
   ```
   =============================================
     ADMIN API KEY CREADA (bootstrap)
     artf_live_...
   =============================================
   ```
   **Copiar esa key.** Si usaste seed en el Paso 1 en vez del bootstrap, usar la `Dashboard Admin (demo)`.
7. En **Settings → Networking → Generate Domain** → copiar la URL pública (ej `https://artificialic-api.up.railway.app`).
8. **Health check:**
   ```bash
   curl https://artificialic-api.up.railway.app/v1/ping
   # → {"status":"ok"}
   ```
9. **Importante:** cambia `BOOTSTRAP_ADMIN_ON_EMPTY=false` en Railway Variables → redeploy. A partir de ahora las keys se crean manualmente por UI o CLI (`railway run python cli.py create-key ...`).

---

## Paso 3 — Vercel (Frontend)

1. Crear cuenta en [vercel.com](https://vercel.com). Hobby plan gratis.
2. **Add New → Project → Import** desde tu repo de GitHub.
3. En la pantalla de config:
   - **Root Directory**: `dashboard/` *(importante)*
   - **Framework Preset**: Vite *(detección automática)*
   - **Build Command**: `npm run build` *(default)*
   - **Output Directory**: `dist` *(default)*
4. En **Environment Variables**:

   | Variable | Valor |
   |---|---|
   | `VITE_API_URL` | `https://artificialic-api.up.railway.app` *(URL del paso 2.7, sin `/v1`)* |

5. **Deploy.** ~1 min.
6. Copiar la URL final (ej `https://artificialic-dashboard.vercel.app`).

---

## Paso 4 — Cerrar el círculo CORS

1. Volver a Railway → Variables del backend.
2. Actualizar `CORS_ORIGINS`:
   ```
   https://artificialic-dashboard.vercel.app,https://artificialic-dashboard-<team>.vercel.app
   ```
   (Vercel genera también URLs para cada preview deploy; puedes añadir un patrón si quieres aceptar todos los previews.)
3. Redeploy (Railway lo hace automático al guardar la variable).

---

## Paso 5 — Primer login al dashboard

1. Abrir `https://artificialic-dashboard.vercel.app` → ir a **Configuración**.
2. Pegar la admin key (copiada del paso 2.6) → **Guardar y probar**.
3. El header debe mostrar "API conectada · admin, budgets:read, budgets:update".
4. Ir a **Configuración → API Keys** → **Nueva Key**:
   - Nombre: `Artificialic Production`
   - Scopes: solo `budgets:write`
   - Rate limit: `300` *(o el que decidas)*
5. **Copiar el plaintext que aparece una sola vez.** Esa es la key que entregas al cliente.

---

## Paso 6 — Entrega a Artificialic

Al cliente:
1. **La API Key:** enviar por canal seguro (1Password/Bitwarden/correo cifrado, nunca por Slack/email plano).
2. **La URL de la API:** `https://artificialic-api.up.railway.app/v1`.
3. **El Integration Guide:** compartir `api/README.md` (sección "Integration Guide — Artificialic") con ejemplos curl/Python/Node.
4. **Rate limit por defecto:** 60/min. Si necesitan más, ajustarlo al crear o vía `PATCH /v1/admin/api-keys/{id}` (feature futura).

---

## Paso 7 — Verificación end-to-end

**Simular a Artificialic:**
```bash
curl -X POST https://artificialic-api.up.railway.app/v1/budgets \
  -H "X-API-Key: artf_live_<la-key-que-entregaste>" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "prod-test-001",
    "client_name": "Test Cliente",
    "client_email": "test@prod.com",
    "service_type": "Chatbot WhatsApp",
    "description": "Verificación end-to-end de producción",
    "estimated_amount": "1234.56",
    "source": "whatsapp"
  }'
# → 201 con el budget creado
```

**Verificar en el dashboard:**
- Refrescar `/budgets` → debe aparecer "Test Cliente" en la lista.
- Click en la fila → slide-over con detalle, status `recibido`.
- Cambiar a `en_revision` → aparece en el timeline.

Si todo funciona, **la plataforma está en producción**.

---

## Operación diaria

### Ver logs
```bash
railway logs                 # backend
vercel logs                  # frontend (o ver en dashboard de Vercel)
```

### Crear/revocar keys vía CLI
```bash
railway run python cli.py create-key --name "Nuevo integrador" --scope budgets:write
railway run python cli.py list-keys
railway run python cli.py revoke-key <uuid>
```

### Rotar una key (sin downtime)
Desde el dashboard: **Configuración → API Keys → botón Rotar** en la fila deseada. La key vieja sigue activa 7 días mientras el consumer migra.

### Actualizar el schema tras cambios de modelos
```bash
cd api
# si usas Alembic:
alembic revision --autogenerate -m "descripción del cambio"
# review el archivo generado en alembic/versions/
git add . && git commit -m "migration: ..."
git push  # Railway auto-deploya y corre migraciones si añades `CMD alembic upgrade head && uvicorn...` al Dockerfile
```

---

## Costos mensuales estimados

| Servicio | Tier | Costo |
|---|---|---|
| Neon | Free | $0 (hasta 0.5 GB storage, 190h compute) |
| Railway | Hobby | $5/mes (con $5 créditos incluidos) |
| Vercel | Hobby | $0 |
| **Total demo** | | **~$5/mes** |

Escalado: Neon Launch ($19/mes) + Railway Pro ($20/mes) cuando crezca el tráfico o storage.

---

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| Dashboard dice "Sin conexión con el backend" | `VITE_API_URL` incorrecto o CORS bloquea | Revisar env de Vercel + `CORS_ORIGINS` en Railway. |
| Artificialic recibe 403 | Scope no es `budgets:write` | Desde dashboard, crear nueva key con el scope correcto. |
| 429 frecuente en ingest | Rate limit por defecto 60/min | Crear key con `rate_limit_per_minute` mayor (ej 300-600). |
| Backend cold-start lento tras inactividad en Neon | Scale-to-zero | Normal en free tier; 1-2s primera request. Upgrade a Launch para warm pool. |
| No recuerdo la admin key | No se puede recuperar | Vía Railway CLI: `railway run python cli.py create-key --name "Recovery Admin" --scope admin --scope budgets:read --scope budgets:update` |

---

*Guía generada para el entregable Artificialic Budget Platform. Última actualización: 2026-04-24.*
