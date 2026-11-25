# Calibración de S01: nitidez y brillo (25/11/2026)

**Resultado: S01 no se pudo calibrar y sigue sin umbral.** Ninguna medida de nitidez probada
separa las fotos legibles de las ilegibles por movimiento con un margen de al menos 2 puntos, y no
hay fotos ilegibles por falta de luz para fijar el brillo mínimo. `umbral` y `umbral_advertencia`
de S01 siguen nulos (D24), así que S01 da `no_aplica` (D29) y el motor no pide otra foto.

## Datos

- **43 fotos nuevas** de facturas **sintéticas** impresas, con nombre `ID_condicion.jpg`
  (normal, ángulo, sombra, fondo de tela, mesa blanca, perspectiva, arrugada, flash, lejos, borrosa
  y movida). Legibilidad: juicio de Manuel Coccoz, foto por foto, en una planilla (si/no).
- **14 fotos del paso 4** (boletos y facturas). Legibilidad: la del paso 4 (ROADMAP y D40).
- Clases: **43 legibles**, **12 ilegibles por movimiento** (10 nuevas y 2 del paso 4) y **2
  ilegibles por resolución** (boleto-lejos y boleto-angulo). Estas dos últimas quedan fuera del
  corte: S01 no mide resolución (ver el pendiente en `services/verifier/ROADMAP.md`).
- Las fotos no están en el repositorio. Acá solo hay números agregados.
- Código medido: commit `ba0a36e` de `main`.

## Cómo repetir la medición

Con el `.venv` del verificador, desde `services/verifier`, y la salida **fuera del repositorio**
(`inspect_images.py` rechaza una carpeta de salida que esté adentro):

```
python tools/inspect_images.py <carpeta-fotos-nuevas> <carpeta-salida>/nuevas
python tools/inspect_images.py <carpeta-fotos-paso-4> <carpeta-salida>/paso4
```

`<carpeta-salida>` tiene que estar fuera del repositorio. `calidad.csv` trae la nitidez actual, el
brillo, si se encontró el papel y si se enderezó; `candidatos.csv`, por qué se descartó cada
región. La legibilidad sale de `<planilla>`, un CSV separado por `;` con las columnas `foto`,
`documento_id`, `condicion`, `se_lee` (si/no) y `notas`. Se cruza con `calidad.csv` por el nombre
de la foto. Las dos variantes de la prueba se calcularon con
un script fuera del repositorio. Usa las mismas funciones del verificador (búsqueda del papel,
desenfoque de Crete, escalado) y solo cambia los píxeles sobre los que se mide:

| Variante | Sobre qué píxeles se mide el desenfoque de Crete (D40) |
|---|---|
| Actual (D39) | Todo el papel, sin un margen de 15 px en el borde, con el papel llevado a 1000 px. |
| Texto 1000 | Lo mismo, pero solo cerca de la tinta: umbral adaptativo (vecindario de 31 px, 15 niveles más oscuro) agrandado 7×7 px. |
| Trazos 1000 | Solo cerca de trazos finos y oscuros: cierre morfológico menos la imagen con un núcleo elíptico de 9×9 px, al menos 25 % más oscuro que su fondo, agrandado 7×7 px. Los pliegues son sombras anchas y quedan afuera. |

## Resultado por variante

"Mejor corte" es la nitidez mínima que menos errores comete: legibles rechazadas más ilegibles que
pasan. Tiempos por foto en la notebook de desarrollo (mediana / máximo), sin contar la búsqueda del
papel (83 / 387 ms), que es la misma en las tres.

| Variante | Margen | Mejor corte | Legibles rechazadas | Ilegibles que pasan | Solo paso 4 | ms por foto |
|---|---:|---:|---:|---:|---:|---|
| Actual | −13,03 | 77,15 | 1 de 43 | 7 de 12 | +0,67 | 72 / 172 |
| Texto 1000 | −7,69 | 78,99 | 1 de 43 | 2 de 12 | +0,82 | 58 / 262 |
| Trazos 1000 | −2,05 | 79,69 | 2 de 43 | 3 de 12 | −0,48 | 71 / 227 |

El margen es la nitidez de la legible menos nítida menos la de la ilegible más nítida: si es
negativo, ningún corte separa las dos clases. En una prueba anterior con 46 fotos, la zona de texto
medida a 2000 px (margen −10,94) y a la resolución original (−20,89) dio peor que a 1000 px: al
agrandar un papel chico se suaviza el texto, y a resolución original la letra mide distinto en cada
foto.

Fotos en el límite (nitidez de cada variante):

| Foto | Se lee | Actual | Texto 1000 | Trazos 1000 |
|---|---|---:|---:|---:|
| 06456-00011243_movida | no | 71,94 | 65,11 | 68,73 |
| 04900-00007360_movida | no | 79,23 | 76,80 | 78,52 |
| 06635-00019036_movida | no | 80,42 | 79,25 | 80,79 |
| 06837-00022196_movida | sí | 83,19 | 83,21 | 83,36 |
| 05179-00018782_movida | sí | 83,56 | 83,47 | 84,07 |
| 06456-00011243_borrosa | sí | 81,47 | 80,95 | 81,50 |
| 04108-00016394_arrugada | sí | 69,26 | 72,51 | 78,74 |

## Qué muestran los números

- **La medida actual mide sobre todo el papel en blanco.** En una factura A4 el texto ocupa poco;
  el resto es grano del papel y pliegues. 09261_borrosa (ilegible) da 81,66, más que ocho legibles.
  Con 57 fotos no se sostiene lo que mostraban las 14 del paso 4 (D40: las ilegibles quedaban con la
  menor nitidez).
- **Medir cerca de la tinta mejora las movidas, pero toma los pliegues como tinta.** En la
  arrugada, la zona de texto cubre el 42,8 % del papel, contra el 16,7 % de la misma factura sin
  arrugar, y vuelve a medir sombras suaves.
- **Los trazos finos arreglan la arrugada (78,74), pero no alcanza.** 06635_movida (80,79) y
  07025_movida (80,68) quedan por encima de cinco legibles (arrugada 78,74, factura-poca-luz 79,38,
  06635_lejos 79,77, factura-movida-desigual 80,18 y factura-angulo 80,42), y los boletos movidos
  del paso 4 dejan de separarse: boleto-movida-extrema (79,86) queda por encima de factura-poca-luz.
- **Las dos tandas tienen escalas distintas.** Con la medida actual, las facturas nuevas sin
  problemas dan entre 84,72 y 87,60, y las buenas y la de flash del paso 4, entre 83,24 y 84,98. Un corte
  único tiene que servir para comprobantes con letra y cantidad de texto muy distintas.

## Brillo

Ninguna foto es ilegible por falta de luz: la legible más oscura es boleto-poca-luz (65,08). Sin
fotos del otro lado no hay corte que calibrar, y fijar un piso sin validarlo no alcanza para
activar S01.

## Detección del papel y enderezado

- **No se encontró el papel** (S01 mide la foto entera, D39):
  - 04900-00007360_mesablanca: el papel se une con la mesa (76,4 % de la foto, 2,4 % de tinta).
  - 05006-00017593_mesablanca: lo mismo (72,5 % de la foto, 2,7 % de tinta).
  - 04900-00007360_normal: 3,0 % de tinta redondeado, apenas debajo del mínimo de 3 %.
  - 04900-00007360_movida y 08792-00003961_movida: 2,9 % de tinta (el movimiento la reparte).
  - 06635-00019036_lejos: el papel queda partido en regiones de 2,0 %, 1,4 % y 0,6 % de la foto,
    todas debajo del mínimo de 5 %.
- **No se enderezó porque el papel toca el borde de la foto:** las tres de fondo de tela, la
  perspectiva, 06837-00022196_movida y la mayoría de las del paso 4.
- **No se enderezó porque el cuadrilátero deja afuera demasiado papel:** factura-poca-luz
  (6,53 %) y factura-sombra-sol (3,20 %), con un máximo de 2,5 %.
- Se enderezaron bien: ángulo, sombra, arrugada, flash, normales y casi todas las movidas.

## Para después

- El mínimo de 3 % de tinta queda justo para facturas A4 con poco texto, y una foto movida lo
  pierde: 09261_borrosa pasó con 3,0 % justo, y 04900_movida y 08792_movida no.
- Con mesa blanca, el papel y la mesa forman una sola región.
- Los pliegues se toman como tinta: afecta a la zona de texto y probablemente también a la densidad
  de tinta con la que se elige el papel.
- La medida candidata es la de trazos finos a 1000 px (la más cercana, −2,05). Se revisa en el paso
  8 con más fotos. Si una medida separa con al menos 2 puntos, va en una rama aparte con una decisión
  que modifique D39 y D40, y recién ahí se cargan los umbrales en una versión nueva de parámetros.
- Para el brillo hacen falta fotos oscuras que no se lean.

## Tabla completa (57 fotos, ordenadas por la nitidez actual)

| Foto | Set | Se lee | Nitidez actual | Texto 1000 | Trazos 1000 | Brillo | Papel | Enderezado |
|---|---|---|---:|---:|---:|---:|---|---|
| 04108-00016394_arrugada | nuevas | sí | 69,26 | 72,51 | 78,74 | 166,72 | sí | sí |
| 05239-00011221_movida | nuevas | **no** | 71,19 | 63,70 | 67,97 | 153,02 | sí | sí |
| 06456-00011243_movida | nuevas | **no** | 71,94 | 65,11 | 68,73 | 154,77 | sí | sí |
| 08792-00003961_movida | nuevas | **no** | 73,33 | 64,84 | 67,73 | 114,89 | no | no |
| boleto-movida-extrema | paso 4 | **no** | 75,85 | 77,13 | 79,86 | 188,52 | sí | no |
| boleto-movida-media | paso 4 | **no** | 76,81 | 78,36 | 79,61 | 181,48 | sí | sí |
| factura-movida-desigual | paso 4 | sí | 77,48 | 79,30 | 80,18 | 159,28 | sí | no |
| boleto-lejos | paso 4 | no (resolución) | 77,87 | 80,46 | 81,58 | 194,48 | sí | sí |
| factura-poca-luz | paso 4 | sí | 78,78 | 79,18 | 79,38 | 77,11 | sí | no |
| factura-angulo | paso 4 | sí | 78,79 | 80,01 | 80,42 | 177,53 | sí | no |
| 04900-00007360_movida | nuevas | **no** | 79,23 | 76,80 | 78,52 | 123,56 | no | no |
| boleto-angulo | paso 4 | no (resolución) | 79,64 | 81,83 | 83,15 | 190,53 | sí | no |
| boleto-poca-luz | paso 4 | sí | 79,89 | 81,72 | 81,42 | 65,08 | sí | sí |
| 06635-00019036_lejos | nuevas | sí | 79,97 | 79,54 | 79,77 | 112,38 | no | no |
| factura-lejos | paso 4 | sí | 80,12 | 82,08 | 82,57 | 193,25 | sí | sí |
| 06635-00019036_movida | nuevas | **no** | 80,42 | 79,25 | 80,79 | 156,13 | sí | sí |
| 08945-00002164_movida | nuevas | **no** | 80,95 | 77,20 | 76,61 | 171,68 | sí | sí |
| 06456-00011243_borrosa | nuevas | sí | 81,47 | 80,95 | 81,50 | 154,51 | sí | sí |
| 09261-00011059_borrosa | nuevas | **no** | 81,66 | 77,55 | 78,52 | 162,92 | sí | sí |
| 05903-00000062_movida | nuevas | **no** | 81,97 | 78,80 | 79,08 | 161,74 | sí | sí |
| 01904-00003446_movida | nuevas | **no** | 82,03 | 78,67 | 79,56 | 163,82 | sí | sí |
| 07025-00019657_movida | nuevas | **no** | 82,29 | 80,20 | 80,68 | 159,15 | sí | sí |
| factura-sombra-sol | paso 4 | sí | 82,77 | 84,55 | 84,95 | 164,97 | sí | no |
| 06837-00022196_movida | nuevas | sí | 83,19 | 83,21 | 83,36 | 152,29 | sí | no |
| factura-buena | paso 4 | sí | 83,24 | 84,47 | 84,75 | 149,04 | sí | no |
| boleto-buena | paso 4 | sí | 83,27 | 85,22 | 85,65 | 154,25 | sí | no |
| 05179-00018782_movida | nuevas | sí | 83,56 | 83,47 | 84,07 | 154,28 | sí | sí |
| 05179-00018782_angulo | nuevas | sí | 83,70 | 82,88 | 84,58 | 170,60 | sí | sí |
| boleto-sombra-sol | paso 4 | sí | 84,15 | 85,60 | 85,86 | 166,34 | sí | no |
| 05179-00018782_sombra | nuevas | sí | 84,45 | 83,85 | 87,13 | 181,85 | sí | sí |
| 04900-00007360_normal | nuevas | sí | 84,72 | 83,76 | 83,47 | 154,94 | no | no |
| 05903-00000062_fondo | nuevas | sí | 84,74 | 85,28 | 84,54 | 157,04 | sí | no |
| boleto-flash | paso 4 | sí | 84,98 | 86,48 | 86,68 | 172,67 | sí | no |
| 05239-00011221_normal | nuevas | sí | 85,20 | 85,04 | 85,01 | 154,61 | sí | sí |
| 07025-00019657_fondo | nuevas | sí | 85,24 | 85,82 | 85,09 | 163,09 | sí | no |
| 05903-00000062_angulo | nuevas | sí | 85,29 | 85,64 | 86,27 | 167,14 | sí | sí |
| 05903-00000062_perspectiva | nuevas | sí | 85,35 | 86,54 | 85,37 | 165,16 | sí | no |
| 06456-00011243_normal | nuevas | sí | 85,39 | 85,37 | 85,42 | 154,98 | sí | sí |
| 06837-00022196_normal | nuevas | sí | 85,44 | 84,93 | 84,89 | 153,58 | sí | sí |
| 07025-00019657_angulo | nuevas | sí | 85,69 | 85,78 | 86,02 | 167,78 | sí | sí |
| 05179-00018782_normal | nuevas | sí | 85,91 | 85,71 | 85,71 | 153,94 | sí | sí |
| 05903-00000062_normal | nuevas | sí | 86,39 | 87,97 | 86,60 | 164,70 | sí | sí |
| 07025-00019657_sombra | nuevas | sí | 86,40 | 88,19 | 87,36 | 166,86 | sí | sí |
| 05903-00000062_sombra | nuevas | sí | 86,45 | 87,79 | 86,38 | 181,53 | sí | sí |
| 06635-00019036_normal | nuevas | sí | 86,83 | 87,20 | 87,33 | 152,81 | sí | sí |
| 05179-00018782_fondo | nuevas | sí | 86,85 | 87,69 | 87,29 | 149,02 | sí | no |
| 07025-00019657_normal | nuevas | sí | 87,09 | 88,92 | 88,11 | 165,85 | sí | sí |
| 04900-00007360_mesablanca | nuevas | sí | 87,23 | 88,27 | 88,67 | 180,65 | no | no |
| 08792-00003961_normal | nuevas | sí | 87,29 | 88,73 | 88,31 | 171,75 | sí | sí |
| 08945-00002164_normal | nuevas | sí | 87,31 | 88,79 | 88,43 | 172,21 | sí | sí |
| 04108-00016394_normal | nuevas | sí | 87,32 | 88,88 | 88,41 | 172,63 | sí | sí |
| 08945-00002164_flash | nuevas | sí | 87,38 | 88,79 | 88,49 | 150,44 | sí | sí |
| 01904-00003446_normal | nuevas | sí | 87,47 | 88,73 | 88,41 | 165,89 | sí | sí |
| 07796-00000086_normal | nuevas | sí | 87,51 | 89,13 | 88,71 | 173,74 | sí | sí |
| 05006-00017593_normal | nuevas | sí | 87,53 | 88,76 | 88,26 | 172,98 | sí | sí |
| 09261-00011059_normal | nuevas | sí | 87,60 | 89,00 | 88,54 | 174,91 | sí | sí |
| 05006-00017593_mesablanca | nuevas | sí | 87,98 | 88,96 | 89,09 | 180,28 | no | no |
