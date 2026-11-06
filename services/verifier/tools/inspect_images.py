"""Procesa una carpeta de fotos y guarda la comparación original/preprocesada y la tabla de calidad.

Uso (con el .venv del verificador):
    python tools/inspect_images.py <carpeta_fotos> <carpeta_salida>

Por foto guarda <nombre>_comparacion.jpg: a la izquierda la original con las regiones candidatas a
papel (verde: elegida; rojo: descartada) y el cuadrilátero del enderezado (azul); a la derecha la
imagen que iría al OCR. Además, calidad.csv (una fila por foto) y candidatos.csv (una fila por
región, con el motivo de descarte).

La carpeta de salida tiene que estar fuera del repositorio: las fotos reales no se suben.
Los umbrales de S01 siguen vacíos (D24); la tabla sirve para ver dónde caería el corte.
"""

import argparse
import csv
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from verifier.image.base import Image, Polygon
from verifier.image.paper import PaperRegion, choose_paper, find_paper_candidates
from verifier.image.preprocess import StraightenedReceipt, enhance_contrast, straighten_receipt
from verifier.image.quality import measure_quality

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}
QUALITY_FILE_NAME = "calidad.csv"
QUALITY_COLUMNS = ("archivo", "nitidez", "iluminacion", "papel", "enderezado", "motivo")
CANDIDATES_FILE_NAME = "candidatos.csv"
CANDIDATES_COLUMNS = ("archivo", "candidata", "area", "densidad_texto", "toca_borde", "resultado")
COMPARISON_HEIGHT = 1200
CHOSEN_COLOR = (0, 200, 0)  # BGR: verde
REJECTED_COLOR = (0, 0, 255)  # BGR: rojo
QUAD_COLOR = (255, 120, 0)  # BGR: azul
LINE_THICKNESS_DIVISOR = 250  # grosor de las líneas: lado largo de la foto / este valor
LABEL_FONT_SCALE = 3.0


@dataclass(frozen=True)
class PhotoInspection:
    """Lo que se mide y se decide sobre una foto, para las dos tablas."""

    file_name: str
    sharpness: float
    illumination: float
    candidates: list[PaperRegion]
    paper: PaperRegion | None
    straightened: StraightenedReceipt


def main() -> None:
    arguments = _parse_arguments()
    _require_outside_repository(arguments.output)
    arguments.output.mkdir(parents=True, exist_ok=True)
    inspections = [inspect_photo(photo, arguments.output) for photo in _photos(arguments.photos)]
    _write_quality_table(inspections, arguments.output / QUALITY_FILE_NAME)
    _write_candidates_table(inspections, arguments.output / CANDIDATES_FILE_NAME)
    _print_quality_table(inspections)


def inspect_photo(photo_path: Path, output: Path) -> PhotoInspection:
    """Mide como S01 (D39, D40): sobre la región del papel en la foto original, antes de CLAHE."""
    photo = _read_image(photo_path)
    candidates = find_paper_candidates(photo)
    paper = choose_paper(candidates)
    straightened = straighten_receipt(photo, paper)
    measurement = measure_quality(photo, paper)
    inspection = PhotoInspection(
        file_name=photo_path.name,
        sharpness=measurement.sharpness,
        illumination=measurement.illumination,
        candidates=candidates,
        paper=paper,
        straightened=straightened,
    )
    comparison = _side_by_side(_annotated(photo, inspection), enhance_contrast(straightened.image))
    _write_image(comparison, output / f"{photo_path.stem}_comparacion.jpg")
    return inspection


def _parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("photos", type=Path, help="carpeta con las fotos (.jpg, .jpeg, .png)")
    parser.add_argument("output", type=Path, help="carpeta de salida, fuera del repositorio")
    return parser.parse_args()


def _require_outside_repository(output: Path) -> None:
    """Las fotos reales tienen datos de terceros: no pueden quedar adentro del repositorio."""
    resolved = output.resolve()
    if resolved.is_relative_to(REPOSITORY_ROOT):
        raise SystemExit(
            f"La carpeta de salida {resolved} está dentro del repositorio ({REPOSITORY_ROOT}). "
            "Elegí una carpeta fuera del repositorio para no subir fotos reales."
        )


def _photos(folder: Path) -> list[Path]:
    if not folder.is_dir():
        raise SystemExit(f"No existe la carpeta de fotos: {folder}")
    photos = sorted(path for path in folder.iterdir() if path.suffix.lower() in IMAGE_SUFFIXES)
    if not photos:
        raise SystemExit(f"No hay fotos .jpg, .jpeg ni .png en {folder}")
    return photos


def _read_image(path: Path) -> Image:
    """np.fromfile + imdecode: cv2.imread falla en Windows con rutas con tildes."""
    image = cv2.imdecode(np.fromfile(path, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"No se pudo leer la imagen: {path}")
    return image


def _write_image(image: Image, path: Path) -> None:
    encoded, buffer = cv2.imencode(".jpg", image)
    if not encoded:
        raise ValueError(f"No se pudo codificar la comparación: {path}")
    buffer.tofile(path)


def _annotated(photo: Image, inspection: PhotoInspection) -> Image:
    """La foto con cada candidata numerada (como en candidatos.csv) y el cuadrilátero, si hubo."""
    marked = photo.copy()
    thickness = max(2, max(photo.shape[:2]) // LINE_THICKNESS_DIVISOR)
    for number, candidate in enumerate(inspection.candidates, start=1):
        color = CHOSEN_COLOR if candidate is inspection.paper else REJECTED_COLOR
        _draw_polygon(marked, candidate.hull, color)
        label_origin = tuple(int(value) for value in candidate.hull.min(axis=0) + thickness * 10)
        cv2.putText(
            marked,
            str(number),
            label_origin,
            cv2.FONT_HERSHEY_SIMPLEX,
            LABEL_FONT_SCALE,
            color,
            thickness,
        )
    if inspection.straightened.corners is not None:
        _draw_polygon(marked, inspection.straightened.corners, QUAD_COLOR)
    return marked


def _draw_polygon(image: Image, polygon: Polygon, color: tuple[int, int, int]) -> None:
    thickness = max(2, max(image.shape[:2]) // LINE_THICKNESS_DIVISOR)
    cv2.polylines(image, [np.round(polygon).astype(np.int32)], True, color, thickness)


def _side_by_side(original: Image, enhanced: Image) -> Image:
    """Las dos imágenes a la misma altura; la preprocesada sale en gris y se pasa a color."""
    enhanced_color = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
    return np.hstack([_to_height(original), _to_height(enhanced_color)])


def _to_height(image: Image) -> Image:
    height, width = image.shape[:2]
    scaled_width = round(width * COMPARISON_HEIGHT / height)
    return cv2.resize(image, (scaled_width, COMPARISON_HEIGHT), interpolation=cv2.INTER_AREA)


def _write_quality_table(inspections: list[PhotoInspection], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as table:
        writer = csv.writer(table)
        writer.writerow(QUALITY_COLUMNS)
        for inspection in inspections:
            writer.writerow(
                [
                    inspection.file_name,
                    f"{inspection.sharpness:.2f}",
                    f"{inspection.illumination:.2f}",
                    _yes_no(inspection.paper is not None),
                    _yes_no(inspection.straightened.corners is not None),
                    inspection.straightened.reason,
                ]
            )


def _write_candidates_table(inspections: list[PhotoInspection], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as table:
        writer = csv.writer(table)
        writer.writerow(CANDIDATES_COLUMNS)
        for inspection in inspections:
            for number, candidate in enumerate(inspection.candidates, start=1):
                writer.writerow(
                    [
                        inspection.file_name,
                        number,
                        f"{candidate.area_fraction:.3f}",
                        f"{candidate.text_density:.3f}",
                        _yes_no(candidate.touches_border),
                        _candidate_result(candidate, inspection.paper),
                    ]
                )


def _candidate_result(candidate: PaperRegion, paper: PaperRegion | None) -> str:
    if candidate is paper:
        return "elegida"
    if candidate.rejection is not None:
        return f"descartada: {candidate.rejection}"
    return "descartada: otra candidata tiene más texto"


def _print_quality_table(inspections: list[PhotoInspection]) -> None:
    """Ordenada por nitidez, de menor a mayor: así se ve dónde caería el corte."""
    print(f"{'archivo':<28} {'nitidez':>8} {'iluminacion':>12}  papel  enderezado  motivo")
    for inspection in sorted(inspections, key=lambda inspection: inspection.sharpness):
        print(
            f"{inspection.file_name:<28} {inspection.sharpness:>8.2f} "
            f"{inspection.illumination:>12.2f}  {_yes_no(inspection.paper is not None):<5}  "
            f"{_yes_no(inspection.straightened.corners is not None):<10}  "
            f"{inspection.straightened.reason}"
        )


def _yes_no(value: bool) -> str:
    return "si" if value else "no"


if __name__ == "__main__":
    main()
