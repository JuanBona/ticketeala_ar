# Plan de trabajo del prototipo

Versión del 27/10/2026. Reemplaza al plan anterior: arrancamos sin código y con dos semanas de atraso
sobre lo previsto. Entrega del prototipo: **18/12/2026**.

## Roles

Cada uno es dueño de sus carpetas. Los demás pueden proponer cambios ahí, pero por PR y con su
aprobación.

| Quién | Rol | Carpetas | Responsable de | Última entrega |
|---|---|---|---|---|
| Juan Cruz | Líder, API y datos | `apps/api`, `infra`, `docs/` | Esquema, migraciones y semillas; login, roles, TOTP y auditoría; cola y almacenamiento; lógica de UC-01, 03, 04, 05, 06, 07, 08 y 10; contratos; conectar web y móvil con la API real; revisar todos los PR; escribir los issues | 14 Codificación y 18 Seguridad |
| Manu | Motor de verificación | `services/verifier`, `data/eval` | Pipeline y señales S01–S12; puntaje y decisión; evaluación y métricas; reporte de UC-09; revisar los PR de Juan Cruz | 15 Prueba |
| Felipe | Interfaces y evaluación | `apps/web`, `apps/mobile`, `design/` | Pantallas web y móvil (primero contra un mock); tableros de UC-08; set de comprobantes etiquetados y manipulados; video de demostración | 16 Manuales y 17 Capacitación |

Los tres juntan unos 17 comprobantes cada uno para el set de evaluación, y los tres tienen que poder
explicar el motor en la defensa.

## Metodología

Iterativa e incremental con prácticas de Scrum (punto 8 del documento), en iteraciones de dos
semanas que empiezan un lunes.

| Práctica | Cuándo | Duración | Qué sale |
|---|---|---|---|
| Reunión de iteración | Lunes 27/10, 9/11, 23/11 y 7/12 | 1 h 15 | Demo (30 min), qué cambiamos (15 min), planificación (30 min) |
| Parte diario | Todos los días, por WhatsApp | 3 líneas | Qué hice, qué hago, qué me traba |
| Sesión de a dos | Semanal: Juan Cruz con Felipe; con Manu cuando haga falta | 1 h | La tarea más difícil de la semana, hecha juntos |
| Revisión de PR | Dentro de las 24 h | 15–30 min | Aprobado o con comentarios concretos |

**Tablero:** GitHub Projects con Pendiente, En curso, En revisión y Hecho. Un issue por tarea, con
etiquetas de caso de uso y rol, creado con la plantilla "Tarea" (trae el prompt para Claude).

**Definición de terminado:** cumple el camino básico del caso de uso, tiene tests en verde, la revisó
otro integrante, quien la hizo la puede explicar, respeta contratos, roles y auditoría, y está en `main`.

## Ciclo de una tarea con Claude Code

1. Tomar un issue y pasarlo a En curso.
2. Abrir una sesión nueva en claude.ai/code (repo `ticketeala_ar`, rama `main`, modo **Plan**).
3. Pegar el prompt del issue. No aprobar un plan que no se entiende: preguntar primero.
4. Aprobar el plan. Claude programa, corre los tests y sube una rama.
5. Escribir `/explicar` y leer la explicación entera.
6. Revisar el diff; comentar líneas y pedir correcciones en la misma sesión.
7. Crear el PR, pegar la explicación en la descripción y avisar por WhatsApp.
8. Quien revisa usa `/revisar` como apoyo, lee el código y aprueba o comenta. Se mergea.

Una sesión por tarea. Si Claude falla dos veces en lo mismo, o contradice `docs/decisiones.md`, se
frena y se avisa al grupo.

## Prioridades

| Prioridad | Qué incluye |
|---|---|
| Obligatorio | Seguridad completa (login, JWT, roles, TOTP, auditoría). UC-01. UC-02 con el motor (S01–S11). Métricas del motor sobre el set etiquetado. UC-05. UC-08. |
| Debería | UC-04. UC-07 políticas versionadas. UC-03 básico. S12. |
| Podría | UC-06. Pantalla de parámetros del motor. UC-09. UC-10 más allá de la semilla. |
| Fuera de alcance | GDS, pagos o transferencias, modelos de aprendizaje automático propios, consulta en línea a ARCA. |

Orden de recorte dentro de Podría: UC-09, UC-06, parámetros, UC-10.

## Plan por iteración

Los números entre paréntesis son los pasos de `PROMPTS.md` de cada rol.

| Iteración | Juan Cruz (API) | Manu (Motor) | Felipe (Interfaces) | Hito |
|---|---|---|---|---|
| 1 · 27/10–8/11 | docker-compose, Prisma, semillas, login con roles, TOTP y auditoría (1–4) | Plan y contrato, esqueleto, S04–S06 e importes, S01 y preprocesamiento (1–4) | Tokens, componentes base, Login web, Mobile-Login y consentimiento con mock (1–3); `labels.csv` | El motor valida aritmética y CAE; login real con roles |
| 2 · 9/11–22/11 | UC-01 completo y contrato de la API (5–6); carga de comprobante con cola y guardado del resultado | QR y S03, OCR y S02, S07–S11, puntaje y `POST /verify` (5–8) | UC-01 en móvil, bandeja de aprobación web, Mobile-OCR y Mobile-Rendición; 15–20 manipulados. Con Juan Cruz: pasar del mock a la API real (5) | **Circuito punta a punta** |
| 3 · 23/11–6/12 | UC-05, UC-04, UC-07 políticas, datos de UC-08, UC-03 básico | Evaluación y métricas (9), S12, ajuste de umbrales | Bandeja de Contaduría, Políticas, Main y Reportes, Cotizaciones | Obligatorio y Debería completos; métricas finales |
| Cierre · 7/12–13/12 | Endurecer seguridad; UC-06 y UC-10 si hay tiempo | UC-09 si hay tiempo; tests faltantes | Pantallas de lo que se sume; correcciones | **Código congelado el 13/12** |
| Cierre · 14/12–18/12 | Puntos 14 y 18 | Punto 15 | Puntos 16 y 17; video | Ensayo de defensa; **entrega 18/12** |

## Riesgos

| Riesgo | Señal | Qué hacemos |
|---|---|---|
| Juan Cruz es cuello de botella | Más de dos PR esperando revisión | Manu revisa los PR de Felipe; en la iteración 3, Manu toma UC-03 o UC-06 de la API |
| Web y móvil son mucho para una persona | El 9/11 no anda el login en las dos | Móvil solo para empleado y aprobador; web para Contaduría y tableros |
| Set de evaluación chico | Menos de 40 comprobantes etiquetados el 9/11 | Completar con sintéticos marcados como tales |
| OCR externo no disponible | Sin clave de API el 9/11 | Adaptador falso con respuestas grabadas |
| Código que nadie entiende | Alguien no sabe explicar lo suyo en la demo | `/explicar` obligatorio; en cada demo cada uno explica algo hecho por otro |
| Atraso general | El 23/11 no anda el circuito | Se recorta todo Podría y UC-03 |
