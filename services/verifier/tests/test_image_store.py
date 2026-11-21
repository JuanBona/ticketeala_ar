"""Descarga de la foto por clave desde el almacenamiento S3 (D17), con S3 simulado (moto)."""

from collections.abc import Iterator

import boto3
import pytest
from botocore.client import BaseClient
from moto import mock_aws

from verifier.settings import StorageSettings
from verifier.storage.image_store import ImageDownloadError, ImageStore, create_s3_client

BUCKET = "comprobantes"
KEY = "comprobantes/2026/10/gasto-101.jpg"
PHOTO = b"\xff\xd8\xff bytes de una foto sintetica"


@pytest.fixture
def s3_client() -> Iterator[BaseClient]:
    """Un S3 en memoria (moto) con el bucket ya creado."""
    with mock_aws():
        client = boto3.client(
            "s3",
            region_name="us-east-1",
            aws_access_key_id="acceso-de-prueba",
            aws_secret_access_key="secreto-de-prueba",
        )
        client.create_bucket(Bucket=BUCKET)
        yield client


def test_image_is_downloaded_by_key(s3_client: BaseClient) -> None:
    s3_client.put_object(Bucket=BUCKET, Key=KEY, Body=PHOTO)
    store = ImageStore(s3_client, BUCKET)

    downloaded = store.download(KEY)

    assert downloaded == PHOTO


def test_missing_image_is_reported_with_its_key(s3_client: BaseClient) -> None:
    store = ImageStore(s3_client, BUCKET)

    with pytest.raises(
        ImageDownloadError,
        match=f"No se pudo descargar la imagen {KEY} del almacenamiento: NoSuchKey",
    ):
        store.download(KEY)


def test_s3_client_uses_the_configured_endpoint_with_path_addressing() -> None:
    settings = StorageSettings(
        endpoint="http://127.0.0.1:8333",
        access_key="acceso-de-prueba",
        secret_key="secreto-de-prueba",
        bucket=BUCKET,
        connect_timeout_seconds=5,
        read_timeout_seconds=30,
    )

    client = create_s3_client(settings)

    assert client.meta.endpoint_url == "http://127.0.0.1:8333"
    assert client.meta.config.s3 == {"addressing_style": "path"}
    assert client.meta.config.read_timeout == 30
