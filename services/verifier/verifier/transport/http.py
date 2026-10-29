"""API HTTP del motor: por ahora solo GET /health; POST /verify llega en el paso 5 (D23)."""

from fastapi import FastAPI

app = FastAPI(title="Verificador de comprobantes de AMR Viajes")


@app.get("/health")
def health() -> dict[str, str]:
    """Responde si el servicio está levantado."""
    return {"status": "ok"}
