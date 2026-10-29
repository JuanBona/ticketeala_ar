"""Modelos del contrato API ↔ verificador (docs/contratos/verifier.schema.json, D23, D28)."""

from datetime import date
from enum import StrEnum
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    TypeAdapter,
    field_validator,
)

# Los patrones usan [0-9] y no \d: en Pydantic \d también acepta dígitos de otros alfabetos.
Amount = Annotated[str, StringConstraints(pattern=r"^-?[0-9]{1,10}\.[0-9]{2}$")]
Currency = Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")]
Cuit = Annotated[str, StringConstraints(pattern=r"^[0-9]{11}$")]
ReceiptType = Annotated[str, StringConstraints(pattern=r"^[1-9][0-9]{0,2}$")]
Dhash = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{16}$")]
ExchangeRateQuote = Annotated[str, StringConstraints(pattern=r"^[0-9]{1,8}\.[0-9]{1,4}$")]
NonEmptyText = Annotated[str, StringConstraints(min_length=1)]
ExpenseId = Annotated[int, Field(ge=1)]
ParametersVersion = Annotated[int, Field(ge=1)]
ScoreThreshold = Annotated[int, Field(ge=0, le=100)]
Confidence = Annotated[float, Field(ge=0, le=1)]
SignalWeight = Annotated[int, Field(ge=0)]
OcrResponse = dict[str, Any]


class SignalCode(StrEnum):
    """Señales del catálogo de 12.5."""

    S01 = "S01"
    S02 = "S02"
    S03 = "S03"
    S04 = "S04"
    S05 = "S05"
    S06 = "S06"
    S07 = "S07"
    S08 = "S08"
    S09 = "S09"
    S10 = "S10"
    S11 = "S11"
    S12 = "S12"


class SignalResult(StrEnum):
    """Dominio resultado_senal (D05)."""

    OK = "ok"
    WARNING = "advertencia"
    FAIL = "falla"
    NOT_APPLICABLE = "no_aplica"


class Decision(StrEnum):
    """Dominio decision_verificacion (D05)."""

    ACCEPTED = "aceptado"
    REVIEW = "revision"
    ALERT = "alerta"


class VerificationStatus(StrEnum):
    """Estado de la respuesta del motor (D21, D25)."""

    VERIFIED = "verificado"
    IMAGE_REJECTED = "imagen_rechazada"
    DUPLICATE_REJECTED = "duplicado_rechazado"
    ERROR = "error"


class ExpenseType(StrEnum):
    """Tipo de gasto que elige el empleado al cargar la foto (D27)."""

    LODGING = "alojamiento"
    TRANSPORT = "transporte"
    MEALS = "comida"
    OTHER = "otros"


class CapUnit(StrEnum):
    """Unidad del tope de TOPE_GASTO_POLITICA (D26)."""

    PER_RECEIPT = "por_comprobante"
    PER_NIGHT = "por_noche"
    PER_DAY = "por_dia"


class ContractModel(BaseModel):
    """Base: alias en español del contrato, sin campos extra y sin conversiones de tipo.

    Se parsea siempre desde JSON (model_validate_json): en modo estricto, "1" no pasa por 1.
    """

    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        strict=True,
        validate_by_name=True,
        validate_by_alias=True,
        serialize_by_alias=True,
    )


class Coordinates(ContractModel):
    latitude: Annotated[float, Field(ge=-90, le=90)] = Field(alias="latitud")
    longitude: Annotated[float, Field(ge=-180, le=180)] = Field(alias="longitud")


class StorageImage(ContractModel):
    """Imagen en el almacenamiento compatible con S3 (cola, D17)."""

    origin: Literal["almacenamiento"] = Field(alias="origen")
    key: NonEmptyText = Field(alias="clave")


class AttachedImage(ContractModel):
    """Imagen adjunta en la parte multipart 'archivo' (POST /verify, D23)."""

    origin: Literal["adjunto"] = Field(alias="origen")
    file_name: NonEmptyText = Field(alias="nombre_archivo")


Image = Annotated[StorageImage | AttachedImage, Field(discriminator="origin")]


class Trip(ContractModel):
    start_date: date = Field(alias="fecha_inicio")
    end_date: date = Field(alias="fecha_fin")
    destination: Coordinates | None = Field(alias="destino")
    origin: Coordinates | None = Field(alias="origen")


class Cap(ContractModel):
    """Tope del tipo de gasto en la política de la solicitud (S11, D26)."""

    amount: Amount = Field(alias="monto")
    unit: CapUnit = Field(alias="unidad")
    quantity: Annotated[int, Field(ge=1)] = Field(alias="cantidad")
    currency: Currency = Field(alias="moneda")


class ExchangeRate(ContractModel):
    """Unidades de la moneda de la política por 1 unidad de 'currency' (D22, D28)."""

    currency: Currency = Field(alias="moneda")
    quote: ExchangeRateQuote = Field(alias="cotizacion")


class PreviousHash(ContractModel):
    expense_id: ExpenseId = Field(alias="gasto_id")
    dhash: Dhash


class PreviousFiscalKey(ContractModel):
    expense_id: ExpenseId = Field(alias="gasto_id")
    cuit: Cuit
    receipt_type: ReceiptType = Field(alias="tipo_comprobante")
    point_of_sale: Annotated[int, Field(ge=0)] = Field(alias="punto_venta")
    receipt_number: Annotated[int, Field(ge=0)] = Field(alias="numero_comprobante")


class HistoricalAmount(ContractModel):
    amount: Amount = Field(alias="monto")
    currency: Currency = Field(alias="moneda")


class Context(ContractModel):
    trip: Trip = Field(alias="viaje")
    expense_type: ExpenseType = Field(alias="tipo_gasto")
    declared_currency: Currency = Field(alias="moneda_declarada")
    cap: Cap | None = Field(alias="tope")
    exchange_rate: ExchangeRate | None = Field(alias="tipo_cambio")
    capture_location: Coordinates | None = Field(alias="ubicacion_captura")
    previous_hashes: list[PreviousHash] = Field(alias="dhash_previos")
    previous_fiscal_keys: list[PreviousFiscalKey] = Field(alias="claves_fiscales_previas")
    amount_history: list[HistoricalAmount] = Field(alias="historial_montos")


class SignalParameters(ContractModel):
    """Una fila de PARAMETRO_SENAL; qué valor usa cada señal lo dice D29."""

    weight: SignalWeight = Field(alias="peso")
    threshold: float | None = Field(alias="umbral")
    warning_threshold: float | None = Field(alias="umbral_advertencia")
    factor: float | None
    blocking: bool = Field(alias="bloqueante")
    enabled: bool = Field(alias="activa")


class Parameters(ContractModel):
    """VERSION_PARAMETROS y sus PARAMETRO_SENAL (D23, D24). RN22 la valida verifier.parameters."""

    version: ParametersVersion
    acceptance_threshold: ScoreThreshold = Field(alias="umbral_aceptacion")
    alert_threshold: ScoreThreshold = Field(alias="umbral_alerta")
    maximum_image_attempts: Annotated[int, Field(ge=1)] = Field(alias="intentos_maximos_imagen")
    maximum_queue_retries: Annotated[int, Field(ge=1)] = Field(alias="reintentos_maximos_cola")
    signals: dict[SignalCode, SignalParameters] = Field(alias="senales")

    @field_validator("signals")
    @classmethod
    def require_every_signal(
        cls, signals: dict[SignalCode, SignalParameters]
    ) -> dict[SignalCode, SignalParameters]:
        """Cada versión trae las 12 señales, como exige el schema."""
        missing = [code.value for code in SignalCode if code not in signals]
        if missing:
            raise ValueError(f"Faltan los parámetros de las señales: {', '.join(missing)}")
        return signals


class Request(ContractModel):
    """Pedido: mensaje de verify.requests y parte 'pedido' de POST /verify (D23)."""

    job_id: UUID
    expense_id: ExpenseId = Field(alias="gasto_id")
    attempt: Annotated[int, Field(ge=1)] = Field(alias="intento")
    image: Image = Field(alias="imagen")
    context: Context = Field(alias="contexto")
    parameters: Parameters = Field(alias="parametros")


class ReadField(ContractModel):
    """Valor normalizado; confianza nula si salió del QR."""

    value: str | None = Field(alias="valor")
    confidence: Confidence | None = Field(alias="confianza")


class ReceiptTypeField(ContractModel):
    """Código de ARCA, o nulo si el comprobante no tiene (exterior o ticket no fiscal; D32)."""

    value: ReceiptType | None = Field(alias="valor")
    confidence: Confidence | None = Field(alias="confianza")


class CurrencyField(ContractModel):
    """La del QR convertida a ISO 4217; sin QR, la declarada. Nunca nula (D31)."""

    value: Currency = Field(alias="valor")
    confidence: Confidence | None = Field(alias="confianza")


class ReadFields(ContractModel):
    """Campos del comprobante; no_gravado, exento y otros_tributos son de S06 (D18, D25)."""

    date: ReadField = Field(alias="fecha")
    cuit: ReadField
    business_name: ReadField = Field(alias="razon_social")
    receipt_type: ReceiptTypeField = Field(alias="tipo_comprobante")
    point_of_sale: ReadField = Field(alias="punto_venta")
    receipt_number: ReadField = Field(alias="numero_comprobante")
    total: ReadField
    net: ReadField = Field(alias="neto")
    vat: ReadField = Field(alias="iva")
    untaxed: ReadField = Field(alias="no_gravado")
    exempt: ReadField = Field(alias="exento")
    other_taxes: ReadField = Field(alias="otros_tributos")
    currency: CurrencyField = Field(alias="moneda")
    cae: ReadField
    cae_expiration: ReadField = Field(alias="cae_vencimiento")
    foreign_tax_id: ReadField = Field(alias="id_fiscal_extranjero")


class Signal(ContractModel):
    """Una fila de SENAL_VERIFICACION; el detalle va en español llano (RNF06)."""

    code: SignalCode = Field(alias="codigo")
    result: SignalResult = Field(alias="resultado")
    observed_value: Annotated[str, StringConstraints(max_length=100)] | None = Field(
        alias="valor_observado"
    )
    penalty: Annotated[int, Field(ge=0)] = Field(alias="penalizacion")
    detail: Annotated[str, StringConstraints(max_length=255)] = Field(alias="detalle")


class ImageQuality(ContractModel):
    sharpness: Annotated[float, Field(ge=0, le=999999.99)] = Field(alias="nitidez")
    illumination: Annotated[float, Field(ge=0, le=255)] = Field(alias="iluminacion")
    forced: bool = Field(alias="forzada")


Detail = Annotated[str, StringConstraints(min_length=1, max_length=255)]


class VerifiedResult(ContractModel):
    """Estado verificado: las 12 señales, puntaje y decisión (D20)."""

    job_id: UUID
    expense_id: ExpenseId = Field(alias="gasto_id")
    status: Literal["verificado"] = Field(alias="estado")
    parameters_version: ParametersVersion = Field(alias="version_parametros")
    image_quality: ImageQuality = Field(alias="calidad_imagen")
    read_fields: ReadFields = Field(alias="campos")
    qr: dict[str, Any] | None
    signals: Annotated[list[Signal], Field(min_length=12, max_length=12)] = Field(alias="senales")
    score: Annotated[int, Field(ge=0, le=100)] = Field(alias="puntaje")
    decision: Decision
    ocr_response: OcrResponse | None = Field(alias="respuesta_ocr")


class RejectedImageResult(ContractModel):
    """Foto rechazada antes del intento N: solo calidad y un detalle para el empleado (D21)."""

    job_id: UUID
    expense_id: ExpenseId = Field(alias="gasto_id")
    status: Literal["imagen_rechazada"] = Field(alias="estado")
    parameters_version: ParametersVersion = Field(alias="version_parametros")
    image_quality: ImageQuality = Field(alias="calidad_imagen")
    detail: Detail = Field(alias="detalle")


class DuplicateResult(ContractModel):
    """Clave fiscal ya rendida: solo S07; campos y respuesta del OCR opcionales (D25, D28)."""

    job_id: UUID
    expense_id: ExpenseId = Field(alias="gasto_id")
    status: Literal["duplicado_rechazado"] = Field(alias="estado")
    parameters_version: ParametersVersion = Field(alias="version_parametros")
    signals: Annotated[list[Signal], Field(min_length=1, max_length=1)] = Field(alias="senales")
    duplicate_of: ExpenseId = Field(alias="duplicado_de")
    # El schema no admite campos nulo: si no se leyeron, la clave no va.
    read_fields: ReadFields | None = Field(
        default=None, alias="campos", exclude_if=lambda read_fields: read_fields is None
    )
    ocr_response: OcrResponse | None = Field(default=None, alias="respuesta_ocr")

    @field_validator("signals")
    @classmethod
    def require_failed_s07(cls, signals: list[Signal]) -> list[Signal]:
        """El duplicado lo marca S07 en falla (D20, fila 2)."""
        signal = signals[0]
        if signal.code is not SignalCode.S07 or signal.result is not SignalResult.FAIL:
            raise ValueError(
                f"Un duplicado lleva solo S07 en falla; llegó {signal.code} en {signal.result}"
            )
        return signals


class ErrorResult(ContractModel):
    """El trabajo falló N veces en la cola; sin resultado del motor (D23)."""

    job_id: UUID
    expense_id: ExpenseId = Field(alias="gasto_id")
    status: Literal["error"] = Field(alias="estado")
    detail: Detail = Field(alias="detalle")


Result = Annotated[
    VerifiedResult | RejectedImageResult | DuplicateResult | ErrorResult,
    Field(discriminator="status"),
]
RESULT_ADAPTER: TypeAdapter[Result] = TypeAdapter(Result)
