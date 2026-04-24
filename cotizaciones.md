Módulo Chat-Cotizaciones — Referencia de arquitectura
Origen: Proyectos CJDG (FastAPI + React + Neon Postgres). Iniciado en V2.1, extendido en V2.3 (invoice mentions), V2.7 (notificaciones) y V2.8 (WebSocket realtime).

Idea central: en vez de un formulario "solicita cotización" que genera un lead muerto, cada solicitud abre un hilo de conversación persistente entre cliente y admin, con mensajes, adjuntos, referencias a facturas y cambios de estado. Es un chat estructurado con contexto de negocio.

1. Modelo de datos (Postgres)
Dos tablas principales:

quotation_threads (el hilo)
id UUID PK
client_id UUID FK → users.id (CASCADE)
service_id INTEGER FK → service_catalog.id (SET NULL, nullable) ⚠️ INTEGER, no UUID
service_name string (snapshot del nombre al crear)
company_name, client_address (snapshot del perfil del cliente)
location_notes, budget_estimate NUMERIC(12,2), requirements TEXT
status string — máquina de estados: pending → active → quoted → negotiating → closed/cancelled
created_at, updated_at, last_message_at
Contadores de no leídos por lado: client_unread, admin_unread (int). Se mantienen al enviar mensaje y se ponen en 0 al leer el hilo.
chat_messages (mensajes del hilo)
id UUID PK
thread_id UUID FK → quotation_threads.id (CASCADE)
sender_type — client | admin | system
sender_id UUID nullable (null para system)
content TEXT + message_type — text | system | status_change | invoice_mention
attachment_url, attachment_name, attachment_type (URLs de ImgBB)
metadata JSONB — ⚠️ atributo ORM message_metadata mapeado a columna metadata (SQLAlchemy reserva metadata como atributo en Base)
read_at, created_at
Migración idempotente (CREATE TABLE IF NOT EXISTS, DO $$ blocks) en backend/migrations/v2_1_chat_quotations_neon.sql.

2. Backend (FastAPI)
Archivos:

models/chat_quotation.py — SQLAlchemy models
schemas/chat_quotation.py — Pydantic v2
routes/chat_quotation.py — endpoints REST
services/ws_manager.py — WebSocket in-memory singleton
services/notifications.py — helper notify() para crear notifs in-app + push WS
Endpoints REST (prefix /api/v1/chat-quotations)
Cliente (5):

Método	Ruta	Qué hace
POST	/threads	Crea hilo + mensaje system + mensaje inicial del cliente
GET	/my-threads?status_filter=	Lista hilos del cliente con preview del último mensaje
GET	/threads/{id}	Detalle con mensajes; marca admin→client como leídos
POST	/threads/{id}/messages	Envía mensaje (text / invoice_mention / adjunto)
POST	/threads/{id}/attachments	Sube archivo a ImgBB, retorna URL
Admin (5):

Método	Ruta	Qué hace
GET	/admin/threads?status_filter=	Lista todos los hilos con datos del cliente
GET	/admin/threads/{id}	Detalle; marca client→admin como leídos
POST	/admin/threads/{id}/messages	Responde; si status era pending lo cambia a active; dispara notif al cliente
POST	/admin/threads/{id}/attachments	Sube adjunto
PATCH	/admin/threads/{id}/status	Cambia status + inserta mensaje system status_change + notif
Patrones importantes
1. Snapshots en el thread: company_name, client_address se copian al crear, no se joinean en vivo. Si el cliente cambia el perfil, el hilo conserva el contexto original.

2. Validación de invoice mentions: al recibir invoice_ids en ChatMessageCreate, se validan contra el owner_user_id correcto:

Cliente envía → owner = current_user.id
Admin envía → owner = thread.client_id (admin solo puede mencionar facturas del cliente de ese hilo)
Si OK, message_type = "invoice_mention" y metadata = {"invoice_ids": [...]}. Al serializar, se inflan a InvoiceBrief para el frontend.

3. Mensaje vacío permitido solo si hay adjunto o invoice_ids. Si no hay nada de eso y content está vacío → 400.

4. Counters de no leídos:

Cliente envía → admin_unread += 1
Admin envía → client_unread += 1
GET detalle del hilo → pone el counter del lado que lee en 0 y actualiza read_at de los mensajes del otro lado.
5. Un hilo cerrado/cancelled bloquea envío de mensajes del cliente (400). Admin puede reabrirlo cambiando status.

3. Realtime (WebSocket)
Endpoint: /api/v1/ws?token=<JWT>

WSManager (services/ws_manager.py) — singleton in-memory:

connections: Dict[user_id, Set[WebSocket]] (soporta múltiples tabs por usuario)
is_admin: Dict[user_id, bool] (cacheado al conectar)
thread_subscribers: Dict[thread_id, Set[user_id]]
Lock asyncio para mutaciones
Acciones client→server (JSON):


{"action": "ping"}                                  // → {"type": "pong"}
{"action": "subscribe_thread", "thread_id": "..."}
{"action": "unsubscribe_thread", "thread_id": "..."}
Eventos server→client:


{"type": "notification",    "payload": {...notification}}
{"type": "chat_message",    "payload": {...message_serialized, thread_id}}
{"type": "thread_updated",  "payload": {"thread_id": "..."}}
Push post-commit: cada endpoint que muta pasa BackgroundTasks y encola:


background_tasks.add_task(ws_manager.send_to_user, thread.client_id, chat_event)
background_tasks.add_task(ws_manager.broadcast_to_admins, chat_event)
Se evita depender de subscribe_thread para el push directo (race condition si el cliente aún no se suscribió al abrir).

Escalar: WSManager es single-process. Para multi-worker → reemplazar por Redis pub/sub (está comentado en el código).

4. Notificaciones in-app
services/notifications.notify() — crea fila en notifications y opcionalmente dispara push WS (evento notification). Try/except interno para que un fallo no tumbe el flow del endpoint.

Triggers desde el módulo:

Admin responde mensaje → type="chat_message", cliente notificado
Admin cambia status → type="quotation_status", cliente notificado con old/new status en metadata
5. Frontend (React + TS + Tailwind)
Cliente (components/Client/Quotations/):

ClientQuotationsList.tsx — lista con badges de no leídos
ClientChatView.tsx — chat con sidebar de contexto (servicio, presupuesto, requisitos)
InvoiceSelectorModal.tsx — modal para adjuntar facturas propias
InvoiceMentionBubble.tsx — render de mensaje tipo invoice_mention
Admin (components/Admin/Quotation/):

QuotationsPanel.tsx — lista con datos del cliente + filtro por status
AdminChatPanel.tsx — chat + sidebar con perfil del cliente (phone, company, email, address)
Integración en frontend:

Axios instance api con JWT auto-inyectado desde localStorage.cjdg_token
WebSocketProvider en main.tsx expone useWebSocket():
subscribe(eventType, cb) — listener por tipo de evento
subscribeThread(id) / unsubscribeThread(id) — al montar/desmontar vista de chat
Listeners filtran por thread_id en el payload
No polling. Todo realtime. Los componentes se suscriben a chat_message y thread_updated y refetchean/mergean cuando llega el evento relevante.
Guard anti-doble-envío: estado sending + respuesta optimista en el chat input.
6. Upload de adjuntos
routes/uploads.py exporta upload_file_to_imgbb(file: UploadFile) como función reutilizable (sin dependency de auth). La rutas /attachments del módulo solo validan ownership del hilo y delegan. Fallback a static/uploads si ImgBB falla (efímero en Railway, ok para MVP).

7. Gotchas aprendidos en el ship
metadata como nombre de columna rompe SQLAlchemy al startup → usar Column("metadata", JSONB) con atributo ORM renombrado (message_metadata).
FK a service_catalog.id es INTEGER, no UUID. Si creas la FK como UUID, CREATE TABLE falla silencioso en Neon.
Pydantic v2 no acepta Field(..., decimal_places=2) — deja que la DB (DECIMAL(12,2)) lo enforce.
Router debe registrarse en main.py con app.include_router(chat_quotation.router, prefix="/api/v1") — si no, 404 silencioso.
No compartas endpoints públicos con Depends(get_current_user) — un 401 en cascada puede tumbar el interceptor de axios y borrar el token.
Polling no escala. Migración a WS en V2.8 fue pure win: sin latencia, sin backoff necesario, sin carga sobre Neon.
8. Qué adaptar al portar
DB: el patrón funciona en cualquier Postgres. Si tu DB no soporta JSONB, usa TEXT+JSON serializado.
Auth: sustituye get_current_user / get_current_admin por tus dependencies.
Uploads: reemplaza ImgBB por S3/Cloudinary/local según el stack.
WS: si vas multi-proceso desde el día uno, salta directo a Redis pub/sub.
Estados del hilo: el set pending/active/quoted/negotiating/closed/cancelled está pensado para B2B con ciclo largo — ajusta según tu dominio.
Invoice mentions es opcional; quítalo si no tienes módulo de facturas. El message_type extensible permite agregar otros tipos (ej: payment_request, file_signed) sin migración.