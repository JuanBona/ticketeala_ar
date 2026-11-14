"""Worker de Redis Streams: consume verify.requests y publica en verify.results (12.4, D23, D30).

Cada pedido se procesa con un consumer group: si el worker falla o se cae, el mensaje queda
pendiente y se retoma con XAUTOCLAIM; en la entrega N (reintentos_maximos_cola) sale con estado
error. Todo resultado se publica, se marca y se confirma en una sola transacción, así un mismo
job_id nunca recibe dos respuestas.
"""

import logging
import os
from collections.abc import Callable
from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel, ConfigDict, ValidationError
from redis import Redis
from redis.exceptions import ResponseError

from verifier.contract import RESULT_ADAPTER, ExpenseId, Request, Result, StorageImage
from verifier.ocr.base import OcrProvider
from verifier.ocr.fake import FakeOcr
from verifier.parameters import InvalidParametersError, check_rn22
from verifier.pipeline import verify
from verifier.settings import (
    QueueSettings,
    load_ocr_settings,
    load_queue_settings,
    load_storage_settings,
)
from verifier.storage.image_store import ImageStore, create_s3_client
from verifier.transport.error_result import error_result

logger = logging.getLogger(__name__)

REQUEST_FIELD = "pedido"  # campo del mensaje de verify.requests (contrato)
RESULT_FIELD = "resultado"  # campo del mensaje de verify.results (contrato)
PROCESSED_KEY_PREFIX = "verify.processed:"
MESSAGES_PER_READ = 10
GROUP_ALREADY_EXISTS = "BUSYGROUP"
LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"

JobProcessor = Callable[[Request, str], Result]  # pedido y clave de la imagen → resultado
StreamMessage = tuple[str, dict[str, str]]


class InvalidRequestError(ValueError):
    """El pedido no cumple el contrato: reintentarlo no lo arregla."""


class _RequestIdentity(BaseModel):
    """Lo mínimo para responder un pedido inválido: a qué trabajo y a qué gasto."""

    model_config = ConfigDict(extra="ignore")

    job_id: UUID
    gasto_id: ExpenseId


@dataclass(frozen=True)
class QueuedJob:
    """Un pedido válido de la cola y la clave de su foto en el almacenamiento (D17)."""

    request: Request
    image_key: str


class StreamWorker:
    """Consumidor del grupo de VERIFY_CONSUMER_GROUP sobre verify.requests (D23)."""

    def __init__(self, redis_client: Redis, settings: QueueSettings, process: JobProcessor) -> None:
        self._redis = redis_client
        self._settings = settings
        self._process = process

    def ensure_group(self) -> None:
        """Crea el grupo desde el principio del stream, así no se pierden pedidos ya publicados."""
        try:
            self._redis.xgroup_create(
                self._settings.requests_stream, self._settings.consumer_group, id="0", mkstream=True
            )
        except ResponseError as error:
            if GROUP_ALREADY_EXISTS not in str(error):
                raise

    def run_once(self) -> int:
        """Primero los mensajes colgados; si no hay, los nuevos. Devuelve cuántos atendió."""
        messages = self._claim_stuck() or self._read_new()
        for message_id, fields in messages:
            self._handle(message_id, fields)
        return len(messages)

    def run_forever(self) -> None:
        """Atiende la cola hasta que el proceso se detenga."""
        while True:
            self.run_once()

    def _claim_stuck(self) -> list[StreamMessage]:
        """XAUTOCLAIM: pedidos entregados y sin confirmar hace más de VERIFY_CLAIM_IDLE_MS."""
        _, messages, _ = self._redis.xautoclaim(
            self._settings.requests_stream,
            self._settings.consumer_group,
            self._settings.consumer_name,
            min_idle_time=self._settings.claim_idle_milliseconds,
            count=MESSAGES_PER_READ,
        )
        return messages

    def _read_new(self) -> list[StreamMessage]:
        """XREADGROUP de mensajes nunca entregados, esperando hasta VERIFY_BLOCK_MS."""
        response = self._redis.xreadgroup(
            self._settings.consumer_group,
            self._settings.consumer_name,
            {self._settings.requests_stream: ">"},
            count=MESSAGES_PER_READ,
            block=self._settings.block_milliseconds,
        )
        if not response:
            return []
        _, messages = response[0]
        return messages

    def _handle(self, message_id: str, fields: dict[str, str]) -> None:
        pedido = fields.get(REQUEST_FIELD, "")
        try:
            job = parse_job(pedido)
        except InvalidRequestError as error:
            self._reject_invalid(message_id, pedido, error)
            return
        if self._already_answered(job.request.job_id):
            self._acknowledge(message_id)
            return
        self._attempt(message_id, job)

    def _attempt(self, message_id: str, job: QueuedJob) -> None:
        """D23: cada entrega es un intento; en la entrega N, una falla publica estado error."""
        request = job.request
        deliveries = self._deliveries(message_id)
        maximum = request.parameters.maximum_queue_retries
        if deliveries > maximum:
            detail = f"El trabajo se entregó {deliveries} veces sin terminar (máximo {maximum})"
            self._publish(message_id, error_result(request.job_id, request.expense_id, detail))
            return
        try:
            result = self._process(request, job.image_key)
        except Exception as error:  # cualquier falla cuenta como un intento fallido (D23, D30)
            logger.exception(
                "Falló la entrega %d de %d del trabajo %s", deliveries, maximum, request.job_id
            )
            if deliveries >= maximum:
                detail = f"El trabajo falló {deliveries} veces: {error}"
                self._publish(message_id, error_result(request.job_id, request.expense_id, detail))
            return
        self._publish(message_id, result)

    def _reject_invalid(self, message_id: str, pedido: str, error: InvalidRequestError) -> None:
        """Sin pedido válido no se conoce N: se responde error si se sabe a qué trabajo."""
        try:
            identity = _RequestIdentity.model_validate_json(pedido)
        except ValidationError:
            logger.error(
                "Mensaje %s sin job_id ni gasto_id legibles; se descarta: %s", message_id, error
            )
            self._acknowledge(message_id)
            return
        self._publish(message_id, error_result(identity.job_id, identity.gasto_id, str(error)))

    def _deliveries(self, message_id: str) -> int:
        """Cuántas veces se entregó el mensaje, según la lista de pendientes del grupo."""
        entries = self._redis.xpending_range(
            self._settings.requests_stream,
            self._settings.consumer_group,
            min=message_id,
            max=message_id,
            count=1,
        )
        if not entries:
            raise RuntimeError(f"El mensaje {message_id} no figura como pendiente en el grupo")
        return entries[0]["times_delivered"]

    def _already_answered(self, job_id: UUID) -> bool:
        return bool(self._redis.exists(_processed_key(job_id)))

    def _publish(self, message_id: str, result: Result) -> None:
        """XADD del resultado, marca del job_id y XACK, todo o nada (MULTI)."""
        transaction = self._redis.pipeline(transaction=True)
        transaction.xadd(
            self._settings.results_stream, {RESULT_FIELD: RESULT_ADAPTER.dump_json(result).decode()}
        )
        transaction.set(
            _processed_key(result.job_id), message_id, ex=self._settings.processed_ttl_seconds
        )
        transaction.xack(self._settings.requests_stream, self._settings.consumer_group, message_id)
        transaction.execute()

    def _acknowledge(self, message_id: str) -> None:
        self._redis.xack(self._settings.requests_stream, self._settings.consumer_group, message_id)


def parse_job(pedido: str) -> QueuedJob:
    """El pedido cumple el contrato y RN22, y trae la imagen por clave del almacenamiento (D23)."""
    try:
        request = Request.model_validate_json(pedido)
        check_rn22(request.parameters)
    except (ValidationError, InvalidParametersError) as error:
        raise InvalidRequestError(f"El pedido no cumple el contrato: {error}") from error
    if not isinstance(request.image, StorageImage):
        raise InvalidRequestError(
            "La cola espera la imagen por clave del almacenamiento (imagen.origen = "
            f"almacenamiento); el pedido trae imagen.origen = {request.image.origin}"
        )
    return QueuedJob(request=request, image_key=request.image.key)


def build_processor(store: ImageStore, ocr: OcrProvider) -> JobProcessor:
    """En producción: baja la foto de S3 y corre el pipeline."""

    def process(request: Request, image_key: str) -> Result:
        return verify(request, store.download(image_key), ocr)

    return process


def create_redis_client(settings: QueueSettings) -> Redis:
    return Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        password=settings.redis_password,
        socket_timeout=settings.socket_timeout_seconds,
        decode_responses=True,
    )


def main() -> None:
    """python -m verifier.transport.stream_worker, con la configuración en variables de entorno."""
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
    queue_settings = load_queue_settings(os.environ)
    storage_settings = load_storage_settings(os.environ)
    store = ImageStore(create_s3_client(storage_settings), storage_settings.bucket)
    ocr = FakeOcr(load_ocr_settings(os.environ).fake_recording)
    redis_client = create_redis_client(queue_settings)
    worker = StreamWorker(redis_client, queue_settings, build_processor(store, ocr))
    worker.ensure_group()
    logger.info("Esperando pedidos en %s", queue_settings.requests_stream)
    worker.run_forever()


def _processed_key(job_id: UUID) -> str:
    return f"{PROCESSED_KEY_PREFIX}{job_id}"


if __name__ == "__main__":
    main()
