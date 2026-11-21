"""Valida documentos contra docs/contratos/verifier.schema.json; lo usan varios tests."""

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

CONTRACTS_DIRECTORY = Path(__file__).resolve().parents[3] / "docs" / "contratos"
SCHEMA_PATH = CONTRACTS_DIRECTORY / "verifier.schema.json"

REQUEST_DEFINITION = "Pedido"
RESULT_DEFINITION = "Resultado"


def load_json(path: Path) -> Any:
    """Lee un archivo JSON en UTF-8."""
    return json.loads(path.read_text(encoding="utf-8"))


def validation_errors(document: dict[str, Any], definition: str) -> list[str]:
    """Valida el documento contra una definición de $defs y devuelve los mensajes de error."""
    schema = load_json(SCHEMA_PATH)
    schema["$ref"] = f"#/$defs/{definition}"
    validator = Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)
    return [error.message for error in validator.iter_errors(document)]
