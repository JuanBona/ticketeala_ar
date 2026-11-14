"""Configuración del motor desde variables de entorno: cola de Redis, S3 y OCR falso (D17, D23).

No hay valores por defecto en el código: los locales están en services/verifier/.env.example.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

Environment = Mapping[str, str]


class SettingsError(ValueError):
    """Falta una variable de entorno o su valor no tiene el formato esperado."""


@dataclass(frozen=True)
class QueueSettings:
    """Redis y los streams de D23; los tiempos de espera van en milisegundos o segundos."""

    redis_host: str
    redis_port: int
    redis_password: str
    socket_timeout_seconds: float
    requests_stream: str
    results_stream: str
    consumer_group: str
    consumer_name: str
    block_milliseconds: int
    claim_idle_milliseconds: int
    processed_ttl_seconds: int


@dataclass(frozen=True)
class StorageSettings:
    """Almacenamiento compatible con S3 donde la API guarda las fotos (D17)."""

    endpoint: str
    access_key: str
    secret_key: str
    bucket: str
    connect_timeout_seconds: float
    read_timeout_seconds: float


@dataclass(frozen=True)
class OcrSettings:
    """Grabación que devuelve el OCR falso hasta que llegue el adaptador real (paso 6)."""

    fake_recording: Path


def load_queue_settings(environ: Environment) -> QueueSettings:
    """Lee la configuración de Redis y de los streams verify.requests y verify.results (D23)."""
    return QueueSettings(
        redis_host=_text(environ, "REDIS_HOST"),
        redis_port=_integer(environ, "REDIS_PORT"),
        redis_password=_text(environ, "REDIS_PASSWORD"),
        socket_timeout_seconds=_decimal(environ, "REDIS_SOCKET_TIMEOUT_SECONDS"),
        requests_stream=_text(environ, "VERIFY_REQUESTS_STREAM"),
        results_stream=_text(environ, "VERIFY_RESULTS_STREAM"),
        consumer_group=_text(environ, "VERIFY_CONSUMER_GROUP"),
        consumer_name=_text(environ, "VERIFY_CONSUMER_NAME"),
        block_milliseconds=_integer(environ, "VERIFY_BLOCK_MS"),
        claim_idle_milliseconds=_integer(environ, "VERIFY_CLAIM_IDLE_MS"),
        processed_ttl_seconds=_integer(environ, "VERIFY_PROCESSED_TTL_SECONDS"),
    )


def load_storage_settings(environ: Environment) -> StorageSettings:
    """Lee el endpoint, las credenciales y el bucket del almacenamiento S3 (D17)."""
    return StorageSettings(
        endpoint=_text(environ, "S3_ENDPOINT"),
        access_key=_text(environ, "S3_ACCESS_KEY"),
        secret_key=_text(environ, "S3_SECRET_KEY"),
        bucket=_text(environ, "S3_BUCKET"),
        connect_timeout_seconds=_decimal(environ, "S3_CONNECT_TIMEOUT_SECONDS"),
        read_timeout_seconds=_decimal(environ, "S3_READ_TIMEOUT_SECONDS"),
    )


def load_ocr_settings(environ: Environment) -> OcrSettings:
    """Lee la ruta de la grabación del OCR falso."""
    return OcrSettings(fake_recording=Path(_text(environ, "OCR_FAKE_RECORDING")))


def _text(environ: Environment, name: str) -> str:
    value = environ.get(name, "")
    if not value:
        raise SettingsError(f"Falta la variable de entorno {name}")
    return value


def _integer(environ: Environment, name: str) -> int:
    value = _text(environ, name)
    try:
        return int(value)
    except ValueError as error:
        raise SettingsError(f"{name} tiene que ser un número entero: {value!r}") from error


def _decimal(environ: Environment, name: str) -> float:
    value = _text(environ, name)
    try:
        return float(value)
    except ValueError as error:
        raise SettingsError(f"{name} tiene que ser un número: {value!r}") from error
