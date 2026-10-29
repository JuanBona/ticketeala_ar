"""Fixtures compartidas: ejemplos del contrato en docs/contratos/ejemplos/verifier."""

import json
from pathlib import Path
from typing import Any

import pytest

EXAMPLES_DIRECTORY = (
    Path(__file__).resolve().parents[3] / "docs" / "contratos" / "ejemplos" / "verifier"
)


@pytest.fixture
def initial_parameters_document() -> dict[str, Any]:
    """Parámetros de la versión 1 (los de pedido-http.json), para que cada test los modifique."""
    request = json.loads((EXAMPLES_DIRECTORY / "pedido-http.json").read_text(encoding="utf-8"))
    return request["parametros"]
