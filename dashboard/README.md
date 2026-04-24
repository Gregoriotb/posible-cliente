# Artificialic Budget Platform — Dashboard

> SPA en React + TypeScript que consume la API propia (`../api/`) para visualizar y gestionar los presupuestos generados por los chatbots de Artificialic.

## Stack

- **Vite + React + TypeScript**
- **Tailwind CSS** con paleta Artificialic en `tailwind.config.js`
- **TanStack Query v5** para cacheo/invalidación de datos
- **Recharts** para gráficos del panel de Analytics
- **@dnd-kit** para el kanban con drag-and-drop
- **axios** para HTTP (interceptores de API Key + manejo de 401/403/429)
- **sonner** para toasts, **date-fns** para fechas relativas en español

## Setup local

```bash
cd "posible cliente/dashboard"
npm install
cp .env.example .env       # revisar VITE_API_URL
npm run dev                # abre en http://localhost:5173
```

**Prerequisito:** el backend (`../api/`) debe estar corriendo en `http://localhost:8000`.

Primera corrida end-to-end:
1. Arrancar backend con data demo:
   ```bash
   cd ../api
   python cli.py seed --reset   # crea 40 budgets + 3 API keys (admin, artificialic, readonly)
   uvicorn app.main:app --reload
   ```
2. Copiar la key `Dashboard Admin (demo)` que imprime el seed.
3. `npm run dev` en el dashboard → abrir `http://localhost:5173` → **Configuración**.
4. Pegar la key admin en "Admin API Key" → **Guardar y probar**.
5. Los scopes detectados aparecen en el header. La app ya muestra los 40 presupuestos en `/budgets`.

## Scripts

```bash
npm run dev       # dev server con HMR
npm run build     # tsc + bundle Vite → dist/
npm run preview   # sirve el build local
npm run lint      # ESLint
```

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | URL base del backend (sin `/v1`). El cliente añade `/v1`. |

## Rutas

- `/` · Panel general (KPIs + últimos presupuestos)
- `/budgets` · Lista tabla/kanban + filtros + slide-over de detalle (query param `?budget=<id>`)
- `/analytics` · KPIs + 4 charts (donut por estado, bar por fuente, line trend, top servicios)
- `/settings` · API Key + gestión de keys + preferencias

## Estructura

```
src/
├── api/
│   ├── client.ts      Axios + interceptores (inyecta X-API-Key, maneja 401/403/429/5xx)
│   ├── budgets.ts     listBudgets · getBudget · patchBudget · addNote
│   ├── analytics.ts   getStats
│   ├── admin.ts       listApiKeys · createApiKey · revokeApiKey · rotateApiKey · me
│   └── types.ts       Budget · ApiKey · AnalyticsStats · …
├── hooks/             TanStack Query hooks
├── components/
│   ├── layout/        AppLayout · Sidebar · Header · MobileDrawer          (SC-001)
│   ├── budgets/       BudgetTable · BudgetKanban · BudgetFilters ·
│   │                  BudgetDetailSlideOver                                (SC-002, SC-003)
│   └── shared/        StatusBadge · PriorityBadge · SourceIcon
├── pages/
│   ├── DashboardPage.tsx
│   ├── BudgetListPage.tsx
│   ├── AnalyticsPage.tsx                                                   (SC-004)
│   └── SettingsPage.tsx                                                    (SC-006)
├── lib/
│   ├── cn.ts          clsx + tailwind-merge
│   ├── format.ts      formatCurrency · formatRelative · formatDateShort
│   └── status.ts      Máquina de estados (espejo del backend) + colores + labels
├── App.tsx            Rutas (react-router-dom)
├── main.tsx           QueryClient + BrowserRouter + Toaster + DevTools
└── index.css          Tailwind + estilos globales
```

## API Keys

El dashboard usa una key admin guardada en `localStorage` (`artf_admin_key`).
Scopes recomendados para la key del dashboard: `admin`, `budgets:read`, `budgets:update`.

Desde **Configuración → API Keys** (tab visible solo con scope `admin`):
- Ver todas las keys emitidas (nunca se muestra el plaintext de keys pre-existentes).
- **Generar la key para Artificialic** con scope `budgets:write` → plaintext aparece una sola vez → copiar con un click → entregar.
- Revocar y rotar (con 7 días de grace period).

## Paleta

```
ai-primary:      #22C55E     ai-secondary:   #3B82F6    ai-accent:  #8B5CF6
ai-primary-dark: #16A34A     ai-surface:     #F8FAFC    ai-border:  #E2E8F0
ai-text:         #0F172A     ai-text-muted:  #64748B    ai-danger:  #EF4444
ai-warning:      #F59E0B     ai-info:        #06B6D4
```

Gradiente de marca: `bg-ai-gradient` (azul → violeta → verde).

## Responsive

- Sidebar → drawer con overlay bajo 768px (toggle por hamburger en header).
- Tabla de presupuestos → cards apiladas bajo 768px.
- Grid de analytics → stack vertical bajo 1024px.

## Deploy (Vercel)

Ver [`../ARTIFICIALIC_DASHBOARD_CONTEXT.md`](../ARTIFICIALIC_DASHBOARD_CONTEXT.md) sección 13.3 para instrucciones completas.

Resumen:
1. Importar repo en Vercel con **Root Directory** = `dashboard/`.
2. Preset: Vite. Build: `npm run build`. Output: `dist`.
3. Env var: `VITE_API_URL` apuntando al backend en Railway.
4. Añadir la URL final de Vercel al `CORS_ORIGINS` del backend.

## Testing

En esta fase de demo no hay tests automatizados del frontend. La verificación es manual — ver script en la raíz o seguir el "golden path" del README de raíz.
