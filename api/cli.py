"""CLI administrativo: manage API keys, reset DB, seed demo data.

Uso:
    python -m cli create-key --name "Artificialic Prod" --scope budgets:write
    python -m cli list-keys
    python -m cli revoke-key <id>
    python -m cli seed --reset
"""
import argparse
import sys

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.schemas.api_key import ApiKeyCreate
from app.services import api_key_service


def _ensure_schema() -> None:
    from app.models import api_key, budget, note, status_change  # noqa: F401

    Base.metadata.create_all(bind=engine)


def cmd_create_key(args: argparse.Namespace) -> int:
    _ensure_schema()
    scopes = args.scope or []
    if not scopes:
        print("error: al menos un --scope es requerido", file=sys.stderr)
        return 2
    with SessionLocal() as db:
        payload = ApiKeyCreate(
            name=args.name,
            scopes=scopes,
            rate_limit_per_minute=args.rate_limit,
        )
        key, plaintext = api_key_service.create_api_key(db, payload, created_by="cli")
    print(f"id:       {key.id}")
    print(f"name:     {key.name}")
    print(f"scopes:   {key.scopes}")
    print(f"prefix:   {key.prefix}")
    print(f"key:      {plaintext}")
    print("\n⚠️  Guarde el valor de `key` ahora. No se podrá recuperar después.")
    return 0


def cmd_list_keys(args: argparse.Namespace) -> int:
    _ensure_schema()
    with SessionLocal() as db:
        keys = api_key_service.list_api_keys(db)
    if not keys:
        print("(no hay API keys)")
        return 0
    print(f"{'ID':36}  {'NAME':30}  {'PREFIX':18}  {'STATUS':10}  SCOPES")
    for k in keys:
        print(
            f"{k.id:36}  {k.name[:30]:30}  {k.prefix:18}  {k.status:10}  {','.join(k.scopes or [])}"
        )
    return 0


def cmd_revoke_key(args: argparse.Namespace) -> int:
    _ensure_schema()
    with SessionLocal() as db:
        key = api_key_service.revoke_api_key(db, args.id)
    if key is None:
        print(f"error: key {args.id} no encontrada", file=sys.stderr)
        return 1
    print(f"revocada: {key.id} ({key.name})")
    return 0


def cmd_seed(args: argparse.Namespace) -> int:
    _ensure_schema()
    from app.db.seed import seed_all

    with SessionLocal() as db:
        result = seed_all(db, reset=args.reset)
    print(f"Seed completado: {result['budgets_created']} presupuestos insertados.\n")
    print("API Keys creadas (plaintext — guardar ahora, no se recuperan):")
    for name, plaintext in result["api_keys"].items():
        print(f"  {name:28s}: {plaintext}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="cli", description="Artificialic Budget Platform — admin CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    p_create = sub.add_parser("create-key", help="Crear API Key")
    p_create.add_argument("--name", required=True)
    p_create.add_argument("--scope", action="append", help="Puede repetirse: --scope budgets:write --scope admin")
    p_create.add_argument("--rate-limit", type=int, default=60, dest="rate_limit")
    p_create.set_defaults(func=cmd_create_key)

    p_list = sub.add_parser("list-keys", help="Listar API Keys")
    p_list.set_defaults(func=cmd_list_keys)

    p_revoke = sub.add_parser("revoke-key", help="Revocar API Key")
    p_revoke.add_argument("id")
    p_revoke.set_defaults(func=cmd_revoke_key)

    p_seed = sub.add_parser("seed", help="Cargar data demo")
    p_seed.add_argument("--reset", action="store_true", help="Truncar tablas antes de seedear")
    p_seed.set_defaults(func=cmd_seed)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
