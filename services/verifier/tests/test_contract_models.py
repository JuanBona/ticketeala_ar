"""Los modelos de verifier.contract aceptan los ejemplos del contrato y los serializan igual (D28)."""

import json
from pathlib import Path

import pytest
from pydantic import BaseModel, ValidationError

from verifier.contract import (
    RESULT_ADAPTER,
    DuplicateResult,
    ErrorResult,
    RejectedImageResult,
    Request,
    VerifiedResult,
)

EXAMPLES_DIRECTORY = (
    Path(__file__).resolve().parents[3] / "docs" / "contratos" / "ejemplos" / "verifier"
)
EXAMPLE_NAMES = sorted(path.name for path in EXAMPLES_DIRECTORY.glob("*.json"))

EXPECTED_MODELS: dict[str, type[BaseModel]] = {
    "pedido-cola.json": Request,
    "pedido-http.json": Request,
    "resultado-verificado.json": VerifiedResult,
    "resultado-imagen-rechazada.json": RejectedImageResult,
    "resultado-duplicado.json": DuplicateResult,
    "resultado-error.json": ErrorResult,
}


def read_example(file_name: str) -> str:
    """Devuelve el texto JSON del ejemplo."""
    return (EXAMPLES_DIRECTORY / file_name).read_text(encoding="utf-8")


def parse_example(file_name: str) -> BaseModel:
    """Los ejemplos que empiezan con 'pedido-' son pedidos; el resto, resultados."""
    if file_name.startswith("pedido-"):
        return Request.model_validate_json(read_example(file_name))
    return RESULT_ADAPTER.validate_json(read_example(file_name))


@pytest.mark.parametrize("file_name", EXAMPLE_NAMES)
def test_example_is_parsed_into_its_model(file_name: str) -> None:
    model = parse_example(file_name)

    assert type(model) is EXPECTED_MODELS[file_name]


@pytest.mark.parametrize("file_name", EXAMPLE_NAMES)
def test_example_serializes_back_to_the_same_json(file_name: str) -> None:
    model = parse_example(file_name)

    serialized = json.loads(model.model_dump_json())

    assert serialized == json.loads(read_example(file_name))


def test_rejected_image_with_score_is_not_accepted() -> None:
    rejected_image = json.loads(read_example("resultado-imagen-rechazada.json"))
    rejected_image["puntaje"] = 70

    with pytest.raises(ValidationError):
        RESULT_ADAPTER.validate_json(json.dumps(rejected_image))
