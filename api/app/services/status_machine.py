"""Máquina de estados del Budget (derivada de sección 1.5 del contexto maestro).

Una transición es válida si `to_status in ALLOWED_TRANSITIONS[from_status]` (o si
se admite como estado terminal).

Terminales definitivos: `completado`. `cancelado` y `rechazado` también son
terminales pero admitimos reabrir desde ellos (los clientes cambian de opinión).
"""

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "recibido":    {"en_revision", "cancelado", "rechazado"},
    "en_revision": {"cotizado", "cancelado", "rechazado", "recibido"},
    "cotizado":    {"negociando", "aprobado", "cancelado", "rechazado"},
    "negociando":  {"cotizado", "aprobado", "cancelado", "rechazado"},
    "aprobado":    {"en_proceso", "cancelado"},
    "en_proceso":  {"completado", "cancelado"},
    "completado":  set(),  # terminal
    "cancelado":   {"en_revision"},   # permitir reabrir
    "rechazado":   {"en_revision"},   # permitir reabrir
}

STATUSES_REQUIRING_REASON = {"cancelado", "rechazado"}


def is_transition_allowed(from_status: str, to_status: str) -> bool:
    if from_status == to_status:
        return False
    return to_status in ALLOWED_TRANSITIONS.get(from_status, set())


def valid_next_statuses(from_status: str) -> set[str]:
    return ALLOWED_TRANSITIONS.get(from_status, set())


def requires_reason(to_status: str) -> bool:
    return to_status in STATUSES_REQUIRING_REASON
