from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from codificador import BASE_FILE, atualizar_base, carregar_base, criar_modelo_base, arquivo_base_ativo, processar


def responder(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False))


def main() -> int:
    parser = argparse.ArgumentParser(description="Integração do Codificador com o PlennaTec")
    subparsers = parser.add_subparsers(dest="comando", required=True)

    processar_parser = subparsers.add_parser("processar")
    processar_parser.add_argument("--arquivo", required=True)
    processar_parser.add_argument("--fornecedor", default="auto")
    processar_parser.add_argument("--tipo", default="auto")

    base_parser = subparsers.add_parser("atualizar-base")
    base_parser.add_argument("--arquivo", required=True)

    subparsers.add_parser("modelo")
    subparsers.add_parser("status")

    args = parser.parse_args()

    if args.comando == "processar":
        responder(processar(Path(args.arquivo), fornecedor=args.fornecedor, tipo=args.tipo))
        return 0

    if args.comando == "atualizar-base":
        destino = atualizar_base(Path(args.arquivo))
        responder({"base": str(destino), "produtos": len(carregar_base(destino))})
        return 0

    if args.comando == "modelo":
        responder({"modelo": str(criar_modelo_base())})
        return 0

    base = arquivo_base_ativo()
    responder(
        {
            "base": str(base),
            "produtos": len(carregar_base(base)),
            "atualizada_em": base.stat().st_mtime,
            "personalizada": base.resolve() == BASE_FILE.resolve(),
        }
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
