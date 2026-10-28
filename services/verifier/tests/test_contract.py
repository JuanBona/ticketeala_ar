"""Valida los ejemplos de docs/contratos/ejemplos/verifier contra verifier.schema.json (D23, D28)."""

import copy
import json
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft202012Validator

CONTRACTS_DIRECTORY = Path(__file__).resolve().parents[3] / "docs" / "contratos"
SCHEMA_PATH = CONTRACTS_DIRECTORY / "verifier.schema.json"
EXAMPLES_DIRECTORY = CONTRACTS_DIRECTORY / "ejemplos" / "verifier"

REQUEST_DEFINITION = "Pedido"
RESULT_DEFINITION = "Resultado"


def load_json(path: Path) -> Any:
    """Lee un archivo JSON en UTF-8."""
    return json.loads(path.read_text(encoding="utf-8"))


def load_example(file_name: str) -> dict[str, Any]:
    """Devuelve una copia del ejemplo, para que cada test lo modifique sin afectar a otros."""
    return copy.deepcopy(load_json(EXAMPLES_DIRECTORY / file_name))


def validation_errors(document: dict[str, Any], definition: str) -> list[str]:
    """Valida el documento contra una definición de $defs y devuelve los mensajes de error."""
    schema = load_json(SCHEMA_PATH)
    schema["$ref"] = f"#/$defs/{definition}"
    validator = Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)
    return [error.message for error in validator.iter_errors(document)]


def definition_for(file_name: str) -> str:
    """Los ejemplos que empiezan con 'pedido-' son pedidos; el resto, resultados."""
    if file_name.startswith("pedido-"):
        return REQUEST_DEFINITION
    return RESULT_DEFINITION


def test_schema_is_valid_json_schema() -> None:
    schema = load_json(SCHEMA_PATH)

    Draft202012Validator.check_schema(schema)


@pytest.mark.parametrize(
    "file_name",
    sorted(path.name for path in EXAMPLES_DIRECTORY.glob("*.json")),
)
def test_example_matches_schema(file_name: str) -> None:
    example = load_example(file_name)

    errors = validation_errors(example, definition_for(file_name))

    assert errors == []


def test_duplicate_accepts_read_fields_and_ocr_response() -> None:
    duplicate = load_example("resultado-duplicado.json")

    errors = validation_errors(duplicate, RESULT_DEFINITION)

    assert "campos" in duplicate and "respuesta_ocr" in duplicate
    assert errors == []


def test_rejected_image_with_score_is_invalid() -> None:
    rejected_image = load_example("resultado-imagen-rechazada.json")
    rejected_image["puntaje"] = 70

    errors = validation_errors(rejected_image, RESULT_DEFINITION)

    assert errors != []


def test_rejected_image_with_read_fields_is_invalid() -> None:
    rejected_image = load_example("resultado-imagen-rechazada.json")
    rejected_image["campos"] = load_example("resultado-verificado.json")["campos"]

    errors = validation_errors(rejected_image, RESULT_DEFINITION)

    assert errors != []


def test_error_with_ocr_response_is_invalid() -> None:
    failed_job = load_example("resultado-error.json")
    failed_job["respuesta_ocr"] = {"fullTextAnnotation": {"text": ""}}

    errors = validation_errors(failed_job, RESULT_DEFINITION)

    assert errors != []


def test_duplicate_with_decision_is_invalid() -> None:
    duplicate = load_example("resultado-duplicado.json")
    duplicate["decision"] = "alerta"

    errors = validation_errors(duplicate, RESULT_DEFINITION)

    assert errors != []


def test_duplicate_without_s07_is_invalid() -> None:
    duplicate = load_example("resultado-duplicado.json")
    duplicate["senales"][0]["codigo"] = "S08"

    errors = validation_errors(duplicate, RESULT_DEFINITION)

    assert errors != []


def test_duplicate_without_original_expense_is_invalid() -> None:
    duplicate = load_example("resultado-duplicado.json")
    del duplicate["duplicado_de"]

    errors = validation_errors(duplicate, RESULT_DEFINITION)

    assert errors != []


def test_verified_without_all_twelve_signals_is_invalid() -> None:
    verified = load_example("resultado-verificado.json")
    verified["senales"].pop()

    errors = validation_errors(verified, RESULT_DEFINITION)

    assert errors != []


def test_decision_with_accent_is_invalid() -> None:
    verified = load_example("resultado-verificado.json")
    verified["decision"] = "revisión"

    errors = validation_errors(verified, RESULT_DEFINITION)

    assert errors != []


def test_signal_result_outside_d05_domain_is_invalid() -> None:
    verified = load_example("resultado-verificado.json")
    verified["senales"][0]["resultado"] = "aprobada"

    errors = validation_errors(verified, RESULT_DEFINITION)

    assert errors != []


def test_parameters_without_s12_are_invalid() -> None:
    request = load_example("pedido-cola.json")
    del request["parametros"]["senales"]["S12"]

    errors = validation_errors(request, REQUEST_DEFINITION)

    assert errors != []


def test_request_without_expense_type_is_invalid() -> None:
    request = load_example("pedido-cola.json")
    del request["contexto"]["tipo_gasto"]

    errors = validation_errors(request, REQUEST_DEFINITION)

    assert errors != []


def test_amount_in_argentine_format_is_invalid() -> None:
    request = load_example("pedido-cola.json")
    request["contexto"]["tope"]["monto"] = "45.000,00"

    errors = validation_errors(request, REQUEST_DEFINITION)

    assert errors != []


def test_image_with_storage_key_and_attachment_is_invalid() -> None:
    request = load_example("pedido-cola.json")
    request["imagen"]["nombre_archivo"] = "factura.jpg"

    errors = validation_errors(request, REQUEST_DEFINITION)

    assert errors != []


def test_job_id_that_is_not_uuid_is_invalid() -> None:
    request = load_example("pedido-cola.json")
    request["job_id"] = "trabajo-101"

    errors = validation_errors(request, REQUEST_DEFINITION)

    assert errors != []
