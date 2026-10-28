# Pantallas

Capturas en `design/screens/<estilo>/`, HTML de referencia en `design/html/<estilo>/` y fuentes
originales (con la lógica de estados) en `design/source/<estilo>/`. Los datos son ilustrativos.
Neumorfismo no tiene Maestros, Contaduria-Rendicion ni Conciliacion: si se elige ese estilo, se
adaptan desde alto contraste.

## Web (`apps/web`)

| Pantalla | Diseño | Ruta | Rol | Caso de uso |
|---|---|---|---|---|
| Ingreso y verificación | Login | `/login` | Todos | Seguridad (TOTP) |
| Panel de gerencia | Main | `/` | Aprobador, gerente | UC-01 (bandeja), UC-08 |
| Reportes | Reportes | `/reportes` | Gerente | UC-08 |
| Revisión de rendiciones y alertas | Contaduria-Rendicion | `/rendiciones` | Contaduría | UC-04, UC-05 |
| Adelantos, conciliación y asientos | Conciliacion | `/conciliacion` | Contaduría | UC-06 |
| Políticas de gasto | Politicas | `/politicas` | Contaduría, RRHH | UC-07 |
| Maestros | Maestros | `/maestros` | Administrador | UC-10 |
| **Cotizaciones** (falta diseñar) | — | `/cotizaciones` | Asesor AMR Turismo | UC-03 |
| **Parámetros del motor** (falta diseñar) | — | `/politicas/motor` | Contaduría | UC-07 |
| **Desempeño del motor** (falta diseñar) | — | `/motor` | Contaduría | UC-09 |

## Móvil (`apps/mobile`)

| Pantalla | Diseño | Rol | Caso de uso |
|---|---|---|---|
| Ingreso | Mobile-Login | Empleado | Seguridad |
| Consentimiento de ubicación | Mobile-Consentimiento | Empleado | Ley 25.326 |
| Inicio y menú | Mobile-Inicio | Empleado | — |
| Nueva solicitud | Mobile-Solicitud | Empleado | UC-01 |
| **Comparativo de cotizaciones** (falta diseñar) | — | Empleado | UC-01 pasos 8–9 |
| Carga de comprobante | Mobile-OCR | Empleado | UC-02 |
| Rendición | Mobile-Rendicion | Empleado | UC-02, UC-04 |
| Mis viajes | Mobile-Viajes | Empleado | UC-01 |
| Aprobar solicitud | Mobile-Aprobar | Aprobador | UC-01 |

Las pantallas que faltan se diseñan siguiendo los tokens del estilo elegido, con el mismo nivel de
detalle que las existentes, antes de programarlas.

## Ajustes a las pantallas existentes por el documento final

- **Mobile-OCR**: mostrar la decisión (aceptado, revisión, alerta), el puntaje de 0 a 100 y la
  explicación de cada señal en falla o advertencia (12.5).
- **Contaduria-Rendicion**: la bandeja de UC-05 ordena por puntaje ascendente y permite confirmar
  o descartar cada señal.
- **Mobile-Solicitud**: después de enviar, la solicitud queda "En cotización" hasta que el empleado
  elige una cotización (UC-01 pasos 6–10).

## Campos nuevos por decisiones del equipo (pendientes de diseño)

Las capturas de `design/` no los muestran. Sumalos al programar cada pantalla:

- **Mobile-Solicitud · Origen del viaje (D19):** selector de ciudad, **opcional**. Lo usa S10 para no
  marcar gastos hechos en el trayecto.
- **Mobile-OCR · Tipo de gasto (D27):** selector **obligatorio** al cargar la foto: alojamiento,
  transporte, comida u otros. Sin él, el motor no puede evaluar S11 ni S12.
- **Mobile-OCR · Moneda (D31):** selector que arranca en **ARS**; el empleado lo cambia solo si el
  comprobante es en otra moneda (lista ISO 4217: USD, EUR, BRL, CLP, UYU…). Con un control real
  y etiqueta visible, no solo un ícono.
