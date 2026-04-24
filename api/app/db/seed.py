"""Seed data demo para desarrollo.

Inserta ~40 presupuestos realistas + 3 API keys (admin, ingest Artificialic, readonly).
Distribuye estados, prioridades, fuentes y montos para que el dashboard se vea vivo.
"""
import random
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.api_key import ApiKey
from app.models.budget import Budget
from app.models.note import Note
from app.models.status_change import StatusChange
from app.schemas.api_key import ApiKeyCreate
from app.services import api_key_service

random.seed(42)  # determinista para reproducibilidad


CLIENTES = [
    ("Ana García",       "ana.garcia@acme.com",       "ACME Corp"),
    ("Beto Ruiz",        "beto@betasoft.io",          "Betasoft"),
    ("Carla Méndez",     "carla.m@grupoceta.mx",      "Grupo Ceta"),
    ("Diego Alcántara",  "diego@delta.com.co",        None),
    ("Elena Prieto",     "elena.prieto@epsilon.cl",   "Epsilon"),
    ("Fernando López",   "f.lopez@zetaindustries.ar", "Zeta Industries"),
    ("Gabriela Sosa",    "gaby@etaconsulting.mx",     "Eta Consulting"),
    ("Hugo Navarro",     "hnavarro@theta.pe",         "Theta SA"),
    ("Irene Quiroga",    "irene@iotasrl.com",         "Iota SRL"),
    ("Jorge Peña",       "jpena@kappalabs.co",        "Kappa Labs"),
    ("Karen Ríos",       "karen@lambdatech.mx",       "Lambda Tech"),
    ("Luis Rangel",      "lrangel@muestudio.com",     "Mu Estudio"),
    ("María Benítez",    "maria@nutrainfo.mx",        "Nutra Info"),
    ("Nicolás Vargas",   "nico@xinet.cr",             "Xi Net"),
    ("Olga Paredes",     "olga@omicroncorp.ec",       "Omicron Corp"),
    ("Pablo Soler",      "psoler@pisigma.es",         "Pi Sigma"),
    ("Quim Bernal",      "quim@rhotec.es",            "Rho Tec"),
    ("Rosa Durán",       "rosa@sigmalabs.mx",         "Sigma Labs"),
    ("Saúl Iriarte",     "siriarte@taumedia.co",      "Tau Media"),
    ("Tamara Ortega",    "tortega@upsilon.cl",        "Upsilon"),
]

SERVICIOS = [
    "Chatbot WhatsApp",
    "Chatbot Web",
    "Catálogo Inteligente",
    "Agente IA Ventas",
    "Automatización Email",
    "Landing con IA",
    "Integración CRM",
    "Voicebot",
    "Dashboard Custom",
]

DESCRIPCIONES = [
    "Necesitamos atender el canal de WhatsApp 24/7 con IA entrenada en nuestro producto.",
    "Buscamos automatizar la atención primaria del sitio web con un chatbot que sepa calificar leads.",
    "Nuestra tienda online tiene 2000+ productos y queremos un catálogo inteligente conversacional.",
    "Requerimos un agente IA que acompañe al cliente por el funnel completo hasta el pago.",
    "Enviamos manuales a >10k contactos — queremos automatizar el proceso con segmentación.",
    "Nuestra landing convierte muy poco; pensamos sumarle una capa conversacional.",
    "Integrar el chatbot con HubSpot (o Salesforce) con sync bidireccional.",
    "Automatizar llamadas salientes básicas — confirmación de citas y recordatorios.",
    "Dashboard custom para el equipo comercial con las métricas propias de nuestro funnel.",
]

SOURCES = ["whatsapp", "web", "messenger", "email"]
PRIORITIES = ["low", "medium", "medium", "medium", "high", "urgent"]
ADMINS = ["María Torres", "Joaquín Rivas", "Lucía Paz", None, None]

WORKFLOW_SCENARIOS = [
    # (probabilidad, secuencia de transiciones desde "recibido")
    (0.25, []),  # recibido, no se ha tocado
    (0.15, ["en_revision"]),
    (0.15, ["en_revision", "cotizado"]),
    (0.12, ["en_revision", "cotizado", "negociando"]),
    (0.10, ["en_revision", "cotizado", "aprobado"]),
    (0.07, ["en_revision", "cotizado", "aprobado", "en_proceso"]),
    (0.05, ["en_revision", "cotizado", "aprobado", "en_proceso", "completado"]),
    (0.06, ["cancelado"]),
    (0.05, ["rechazado"]),
]


def _pick_scenario() -> list[str]:
    r = random.random()
    cum = 0.0
    for prob, seq in WORKFLOW_SCENARIOS:
        cum += prob
        if r <= cum:
            return seq
    return []


def _reset(db: Session) -> None:
    db.query(Note).delete()
    db.query(StatusChange).delete()
    db.query(Budget).delete()
    db.query(ApiKey).delete()
    db.commit()


def seed_api_keys(db: Session) -> dict[str, str]:
    """Crea 3 API keys demo. Retorna dict {name: plaintext}."""
    now = datetime.now(UTC).replace(tzinfo=None)
    created: dict[str, str] = {}
    for cfg in [
        ("Dashboard Admin (demo)", ["admin", "budgets:read", "budgets:update"], 120),
        ("Artificialic Production", ["budgets:write"], 300),
        ("Dashboard Readonly (demo)", ["budgets:read"], 60),
    ]:
        payload = ApiKeyCreate(name=cfg[0], scopes=cfg[1], rate_limit_per_minute=cfg[2])
        key, plaintext = api_key_service.create_api_key(db, payload, created_by="seed")
        created[key.name] = plaintext
    return created


def seed_budgets(db: Session, ingest_key_id: str, n: int = 40) -> int:
    """Crea n presupuestos con historias de estados variadas, fechas distribuidas en 30 días."""
    now = datetime.now(UTC).replace(tzinfo=None)
    count = 0
    for i in range(n):
        client = random.choice(CLIENTES)
        service = random.choice(SERVICIOS)
        description = random.choice(DESCRIPCIONES)
        amount = Decimal(random.choice([800, 1500, 2200, 3000, 4500, 5800, 7500, 9800, 12000, 15000]))
        days_ago = random.randint(0, 29)
        created_at = now - timedelta(days=days_ago, hours=random.randint(0, 23))

        budget = Budget(
            external_id=f"chatbot-demo-{i:04d}",
            client_name=client[0],
            client_email=client[1],
            client_company=client[2],
            service_type=service,
            description=description,
            estimated_amount=amount,
            currency=random.choice(["USD", "USD", "USD", "MXN", "EUR"]),
            priority=random.choice(PRIORITIES),
            source=random.choice(SOURCES),
            assigned_to=random.choice(ADMINS),
            tags=random.sample(["ventas", "crm", "enterprise", "b2b", "b2c", "urgente", "retorno"], k=random.randint(0, 3)),
            created_at=created_at,
            updated_at=created_at,
            created_by_key_id=ingest_key_id,
        )
        db.add(budget)
        db.flush()

        current_status = "recibido"
        current_time = created_at
        db.add(StatusChange(
            budget_id=budget.id, from_status=None, to_status=current_status,
            changed_by="ingest:Artificialic Production", changed_at=created_at,
            reason="Creado desde chatbot",
        ))

        for next_status in _pick_scenario():
            # Simular paso de 1-36h entre transiciones
            current_time = current_time + timedelta(hours=random.randint(1, 36))
            if current_time > now:
                current_time = now
            reason = None
            if next_status in ("cancelado", "rechazado"):
                reason = random.choice(["Cliente desistió", "Fuera de presupuesto", "No procede"])
            db.add(StatusChange(
                budget_id=budget.id, from_status=current_status, to_status=next_status,
                changed_by=f"dashboard:{random.choice(['María Torres', 'Joaquín Rivas', 'Lucía Paz'])}",
                changed_at=current_time, reason=reason,
            ))
            current_status = next_status

        budget.status = current_status
        budget.updated_at = current_time

        # 30% chance de tener 1-2 notas
        if random.random() < 0.3:
            for _ in range(random.randint(1, 2)):
                db.add(Note(
                    budget_id=budget.id,
                    author=random.choice(["María Torres", "Joaquín Rivas", "Lucía Paz"]),
                    content=random.choice([
                        "Cliente respondió rápido, buena señal.",
                        "Revisar con legal antes de enviar propuesta.",
                        "Coordinado call para el jueves.",
                        "Presupuesto ajustado a lo que pidieron.",
                        "Esperando feedback del área técnica del cliente.",
                    ]),
                    created_at=current_time,
                ))
        count += 1

    db.commit()
    return count


def seed_all(db: Session, reset: bool = False) -> dict:
    """Entry point: resetea (opcional) + crea keys + crea budgets."""
    if reset:
        _reset(db)
    keys = seed_api_keys(db)
    ingest_key = next((k for k in db.query(ApiKey).all() if "budgets:write" in (k.scopes or [])), None)
    assert ingest_key is not None
    created = seed_budgets(db, ingest_key.id)
    return {"api_keys": keys, "budgets_created": created}
