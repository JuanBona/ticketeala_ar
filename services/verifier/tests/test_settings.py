"""Configuración del motor desde variables de entorno (D17, D23)."""

from pathlib import Path

import pytest

from verifier.settings import (
    SettingsError,
    load_ocr_settings,
    load_queue_settings,
    load_storage_settings,
)

ENV_EXAMPLE_PATH = Path(__file__).resolve().parents[1] / ".env.example"

QUEUE_ENVIRONMENT = {
    "REDIS_HOST": "127.0.0.1",
    "REDIS_PORT": "6379",
    "REDIS_PASSWORD": "clave-de-prueba",
    "REDIS_SOCKET_TIMEOUT_SECONDS": "10",
    "VERIFY_REQUESTS_STREAM": "verify.requests",
    "VERIFY_RESULTS_STREAM": "verify.results",
    "VERIFY_CONSUMER_GROUP": "verifier",
    "VERIFY_CONSUMER_NAME": "verifier-1",
    "VERIFY_BLOCK_MS": "5000",
    "VERIFY_CLAIM_IDLE_MS": "60000",
    "VERIFY_PROCESSED_TTL_SECONDS": "604800",
}

STORAGE_ENVIRONMENT = {
    "S3_ENDPOINT": "http://127.0.0.1:8333",
    "S3_ACCESS_KEY": "acceso-de-prueba",
    "S3_SECRET_KEY": "secreto-de-prueba",
    "S3_BUCKET": "comprobantes",
    "S3_CONNECT_TIMEOUT_SECONDS": "5",
    "S3_READ_TIMEOUT_SECONDS": "30",
}


def read_env_example() -> dict[str, str]:
    """Las líneas NOMBRE=valor de services/verifier/.env.example, sin comentarios."""
    lines = ENV_EXAMPLE_PATH.read_text(encoding="utf-8").splitlines()
    pairs = [line.split("=", 1) for line in lines if line and not line.startswith("#")]
    return {name: value for name, value in pairs}


def test_queue_settings_are_read_from_the_environment() -> None:
    settings = load_queue_settings(QUEUE_ENVIRONMENT)

    assert settings.redis_port == 6379
    assert settings.requests_stream == "verify.requests"
    assert settings.claim_idle_milliseconds == 60000


def test_storage_settings_are_read_from_the_environment() -> None:
    settings = load_storage_settings(STORAGE_ENVIRONMENT)

    assert settings.endpoint == "http://127.0.0.1:8333"
    assert settings.bucket == "comprobantes"
    assert settings.read_timeout_seconds == 30.0


def test_ocr_settings_are_read_from_the_environment() -> None:
    settings = load_ocr_settings({"OCR_FAKE_RECORDING": "grabacion.json"})

    assert settings.fake_recording == Path("grabacion.json")


def test_missing_variable_is_named_in_the_error() -> None:
    environment = {name: value for name, value in STORAGE_ENVIRONMENT.items() if name != "S3_BUCKET"}

    with pytest.raises(SettingsError, match="Falta la variable de entorno S3_BUCKET"):
        load_storage_settings(environment)


def test_empty_variable_counts_as_missing() -> None:
    environment = {**QUEUE_ENVIRONMENT, "REDIS_PASSWORD": ""}

    with pytest.raises(SettingsError, match="REDIS_PASSWORD"):
        load_queue_settings(environment)


def test_non_numeric_value_is_rejected_with_its_value() -> None:
    environment = {**QUEUE_ENVIRONMENT, "REDIS_PORT": "seis mil"}

    with pytest.raises(SettingsError, match="REDIS_PORT tiene que ser un número entero: 'seis mil'"):
        load_queue_settings(environment)


def test_env_example_defines_every_setting() -> None:
    environment = read_env_example()

    load_queue_settings(environment)
    load_storage_settings(environment)
    load_ocr_settings(environment)
