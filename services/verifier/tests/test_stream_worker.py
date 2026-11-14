"""Worker de Redis Streams: consumer group, XACK, XAUTOCLAIM, error tras N entregas (D23, D30)."""

import json
from typing import Any

import fakeredis
import pytest
from ocr_doubles import CountingOcr
from synthetic_images import receipt_photo_png

from verifier.contract import Request, Result
from verifier.pipeline import verify
from verifier.settings import QueueSettings
from verifier.storage.image_store import ImageDownloadError
from verifier.transport.stream_worker import StreamWorker

SETTINGS = QueueSettings(
    redis_host="sin-uso",
    redis_port=6379,
    redis_password="sin-uso",
    socket_timeout_seconds=10,
    requests_stream="verify.requests",
    results_stream="verify.results",
    consumer_group="verifier",
    consumer_name="verifier-1",
    block_milliseconds=1,
    # Con 0, un mensaje sin confirmar se retoma en la vuelta siguiente: no hace falta esperar.
    claim_idle_milliseconds=0,
    processed_ttl_seconds=3600,
)
CRASHED_CONSUMER = "verifier-caido"
MAXIMUM_DELIVERIES = 3  # reintentos_maximos_cola de pedido-cola.json
STORAGE_FAILURE = "No se pudo descargar la imagen comprobantes/2026/10/gasto-101.jpg: NoSuchKey"


class RecordingProcessor:
    """Corre el pipeline real con la foto sintética y el OCR falso; anota cada llamada."""

    def __init__(self) -> None:
        self.image_keys: list[str] = []

    def __call__(self, request: Request, image_key: str) -> Result:
        self.image_keys.append(image_key)
        return verify(request, receipt_photo_png(), CountingOcr())


class FailingProcessor:
    """Simula que el almacenamiento no devuelve la foto en ninguna entrega."""

    def __init__(self) -> None:
        self.calls = 0

    def __call__(self, request: Request, image_key: str) -> Result:
        self.calls += 1
        raise ImageDownloadError(STORAGE_FAILURE)


@pytest.fixture
def redis_client() -> fakeredis.FakeRedis:
    return fakeredis.FakeRedis(decode_responses=True)


def start_worker(redis_client: fakeredis.FakeRedis, processor: Any) -> StreamWorker:
    worker = StreamWorker(redis_client, SETTINGS, processor)
    worker.ensure_group()
    return worker


def publish(redis_client: fakeredis.FakeRedis, pedido: str) -> None:
    redis_client.xadd(SETTINGS.requests_stream, {"pedido": pedido})


def published_results(redis_client: fakeredis.FakeRedis) -> list[dict[str, Any]]:
    entries = redis_client.xrange(SETTINGS.results_stream)
    return [json.loads(fields["resultado"]) for _, fields in entries]


def pending_count(redis_client: fakeredis.FakeRedis) -> int:
    return redis_client.xpending(SETTINGS.requests_stream, SETTINGS.consumer_group)["pending"]


def test_job_result_is_published_to_the_results_stream(
    redis_client: fakeredis.FakeRedis, queue_request_document: dict[str, Any]
) -> None:
    worker = start_worker(redis_client, RecordingProcessor())
    publish(redis_client, json.dumps(queue_request_document))

    worker.run_once()

    [result] = published_results(redis_client)
    assert result["job_id"] == queue_request_document["job_id"]
    assert result["estado"] in {"verificado", "imagen_rechazada"}


def test_processed_job_is_acknowledged(
    redis_client: fakeredis.FakeRedis, queue_request_document: dict[str, Any]
) -> None:
    worker = start_worker(redis_client, RecordingProcessor())
    publish(redis_client, json.dumps(queue_request_document))

    worker.run_once()

    assert pending_count(redis_client) == 0


def test_processor_receives_the_image_key(
    redis_client: fakeredis.FakeRedis, queue_request_document: dict[str, Any]
) -> None:
    processor = RecordingProcessor()
    worker = start_worker(redis_client, processor)
    publish(redis_client, json.dumps(queue_request_document))

    worker.run_once()

    assert processor.image_keys == ["comprobantes/2026/10/gasto-101.jpg"]


def test_stuck_job_of_a_crashed_consumer_is_claimed_and_processed(
    redis_client: fakeredis.FakeRedis, queue_request_document: dict[str, Any]
) -> None:
    worker = start_worker(redis_client, RecordingProcessor())
    publish(redis_client, json.dumps(queue_request_document))
    redis_client.xreadgroup(
        SETTINGS.consumer_group, CRASHED_CONSUMER, {SETTINGS.requests_stream: ">"}
    )

    worker.run_once()

    assert len(published_results(redis_client)) == 1
    assert pending_count(redis_client) == 0


def test_failed_job_stays_pending_before_the_last_delivery(
    redis_client: fakeredis.FakeRedis, queue_request_document: dict[str, Any]
) -> None:
    worker = start_worker(redis_client, FailingProcessor())
    publish(redis_client, json.dumps(queue_request_document))

    for _ in range(MAXIMUM_DELIVERIES - 1):
        worker.run_once()

    assert published_results(redis_client) == []
    assert pending_count(redis_client) == 1


def test_failed_job_publishes_an_error_on_the_last_delivery_and_is_acknowledged(
    redis_client: fakeredis.FakeRedis, queue_request_document: dict[str, Any]
) -> None:
    worker = start_worker(redis_client, FailingProcessor())
    publish(redis_client, json.dumps(queue_request_document))

    for _ in range(MAXIMUM_DELIVERIES):
        worker.run_once()

    [result] = published_results(redis_client)
    assert result["estado"] == "error"
    assert result["detalle"] == f"El trabajo falló 3 veces: {STORAGE_FAILURE}"
    assert pending_count(redis_client) == 0


def test_job_delivered_more_times_than_allowed_publishes_an_error_without_processing(
    redis_client: fakeredis.FakeRedis, queue_request_document: dict[str, Any]
) -> None:
    processor = RecordingProcessor()
    worker = start_worker(redis_client, processor)
    publish(redis_client, json.dumps(queue_request_document))
    # Un consumidor que se cae a mitad de cada intento: 3 entregas sin respuesta ni confirmación.
    redis_client.xreadgroup(
        SETTINGS.consumer_group, CRASHED_CONSUMER, {SETTINGS.requests_stream: ">"}
    )
    for _ in range(MAXIMUM_DELIVERIES - 1):
        redis_client.xautoclaim(
            SETTINGS.requests_stream, SETTINGS.consumer_group, CRASHED_CONSUMER, min_idle_time=0
        )

    worker.run_once()

    [result] = published_results(redis_client)
    assert result["estado"] == "error"
    assert processor.image_keys == []


def test_same_job_id_is_processed_once(
    redis_client: fakeredis.FakeRedis, queue_request_document: dict[str, Any]
) -> None:
    processor = RecordingProcessor()
    worker = start_worker(redis_client, processor)
    publish(redis_client, json.dumps(queue_request_document))
    publish(redis_client, json.dumps(queue_request_document))

    worker.run_once()

    assert len(processor.image_keys) == 1
    assert len(published_results(redis_client)) == 1
    assert pending_count(redis_client) == 0


def test_job_that_already_published_an_error_is_not_answered_again(
    redis_client: fakeredis.FakeRedis, queue_request_document: dict[str, Any]
) -> None:
    processor = FailingProcessor()
    worker = start_worker(redis_client, processor)
    publish(redis_client, json.dumps(queue_request_document))
    for _ in range(MAXIMUM_DELIVERIES):
        worker.run_once()
    publish(redis_client, json.dumps(queue_request_document))

    worker.run_once()

    assert len(published_results(redis_client)) == 1
    assert processor.calls == MAXIMUM_DELIVERIES
    assert pending_count(redis_client) == 0


def test_request_outside_the_contract_publishes_an_error_at_once(
    redis_client: fakeredis.FakeRedis, queue_request_document: dict[str, Any]
) -> None:
    worker = start_worker(redis_client, RecordingProcessor())
    del queue_request_document["contexto"]["tipo_gasto"]
    publish(redis_client, json.dumps(queue_request_document))

    worker.run_once()

    [result] = published_results(redis_client)
    assert result["estado"] == "error"
    assert "tipo_gasto" in result["detalle"]
    assert pending_count(redis_client) == 0


def test_request_with_an_attached_image_publishes_an_error_at_once(
    redis_client: fakeredis.FakeRedis, queue_request_document: dict[str, Any]
) -> None:
    worker = start_worker(redis_client, RecordingProcessor())
    queue_request_document["imagen"] = {"origen": "adjunto", "nombre_archivo": "foto.jpg"}
    publish(redis_client, json.dumps(queue_request_document))

    worker.run_once()

    [result] = published_results(redis_client)
    assert result["estado"] == "error"
    assert "clave" in result["detalle"]


@pytest.mark.parametrize(
    "fields",
    [
        {"pedido": "esto no es JSON"},
        {"pedido": json.dumps({"gasto_id": 101, "intento": 1})},
        {"otro_campo": "un mensaje sin el campo pedido"},
    ],
    ids=["no-es-json", "json-sin-job-id", "sin-campo-pedido"],
)
def test_message_without_a_readable_job_id_is_acknowledged_without_a_result(
    redis_client: fakeredis.FakeRedis, fields: dict[str, str]
) -> None:
    worker = start_worker(redis_client, RecordingProcessor())
    redis_client.xadd(SETTINGS.requests_stream, fields)

    worker.run_once()

    assert published_results(redis_client) == []
    assert pending_count(redis_client) == 0


def test_consumer_group_can_be_created_twice(redis_client: fakeredis.FakeRedis) -> None:
    worker = start_worker(redis_client, RecordingProcessor())

    worker.ensure_group()

    groups = redis_client.xinfo_groups(SETTINGS.requests_stream)
    assert [group["name"] for group in groups] == [SETTINGS.consumer_group]
