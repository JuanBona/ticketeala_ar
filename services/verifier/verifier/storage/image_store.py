"""Baja la foto del comprobante por su clave desde el almacenamiento compatible con S3 (D17).

Usa un cliente S3 estándar (boto3): cambiar SeaweedFS por otro proveedor no toca este código.
"""

import boto3
from botocore.client import BaseClient
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from verifier.settings import StorageSettings

# SeaweedFS ignora la región, pero la firma v4 de S3 necesita una.
SIGNING_REGION = "us-east-1"


class ImageDownloadError(RuntimeError):
    """No se pudo bajar la foto; en la cola, el trabajo se reintenta (D23)."""


class ImageStore:
    """Lectura de fotos de un bucket; el motor nunca escribe en el almacenamiento."""

    def __init__(self, client: BaseClient, bucket: str) -> None:
        self._client = client
        self._bucket = bucket

    def download(self, key: str) -> bytes:
        """D23: el pedido de la cola trae la clave de la imagen en el bucket."""
        try:
            response = self._client.get_object(Bucket=self._bucket, Key=key)
            return response["Body"].read()
        except ClientError as error:
            raise _download_error(key, error.response["Error"]["Code"]) from error
        except BotoCoreError as error:
            raise _download_error(key, str(error)) from error


def create_s3_client(settings: StorageSettings) -> BaseClient:
    """Cliente S3 contra el endpoint configurado, con direcciones por ruta (bucket en la URL)."""
    return boto3.client(
        "s3",
        endpoint_url=settings.endpoint,
        aws_access_key_id=settings.access_key,
        aws_secret_access_key=settings.secret_key,
        region_name=SIGNING_REGION,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            connect_timeout=settings.connect_timeout_seconds,
            read_timeout=settings.read_timeout_seconds,
        ),
    )


def _download_error(key: str, reason: str) -> ImageDownloadError:
    return ImageDownloadError(f"No se pudo descargar la imagen {key} del almacenamiento: {reason}")
