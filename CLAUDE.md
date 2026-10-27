# AMR Viajes

Proyecto Final ISI · UTN FRRo · 2026. Equipo: Felipe Fernández, Juan Cruz Bonanno, Manuel Coccoz.
Tutor: Mario Bressano.

Sistema de gestión de viajes corporativos con **verificación de comprobantes** para la Mutual AMR.
El núcleo técnico es un **motor de verificación diseñado por el equipo**: el OCR externo es una
etapa más. La cátedra evalúa que esa inteligencia esté diseñada e integrada como software propio.

## Fuentes de verdad (en este orden)

1. `docs/fuente/etapa3.pdf` — documento de Etapa 3 (texto buscable en `docs/fuente/etapa3.txt`).
   Casos de uso en la sección 12.3, motor en 12.5, arquitectura en 12.4.
2. `docs/decisiones.md` — decisiones del equipo que corrigen o completan el documento.
   **Si contradice al PDF, gana `decisiones.md`.**
3. `docs/modelo-datos.sql`, `docs/motor-verificacion.md`, `docs/casos-de-uso.md`, `docs/pantallas.md`.
4. `design/` — capturas y HTML de referencia de las pantallas.

Antes de implementar un caso de uso, leé su sección en el PDF (camino básico, alternativos,
reglas de negocio) y respetá sus reglas. Si algo no está definido, preguntá; no inventes reglas.

## Alcance de este repositorio: el prototipo académico

El contrato del documento prevé 15 meses. Lo que se programa acá es el **prototipo que se entrega
el 18 de diciembre de 2026**, con el alcance de `docs/casos-de-uso.md` (columna "Prototipo").
No agregues funciones fuera de ese alcance. Excluido siempre: emisión de pasajes (GDS), pagos o
transferencias, modelos de aprendizaje automático propios, consulta en línea a ARCA.

Fechas: 26/10 tercera entrega del documento (hecha) · 23/11 circuito punta a punta funcionando ·
13/12 código congelado · 18/12 entrega del prototipo. Plan completo en `docs/plan-trabajo.md`.

## Estructura

```
services/verifier   Python 3.12 · FastAPI · OpenCV · pyzbar · imagehash · pandas · pytest
apps/api            Node.js 22 · TypeScript · NestJS · Prisma · PostgreSQL 17
apps/web            React · TypeScript · Vite   (Contaduría, aprobadores, gerencia, asesor, admin)
apps/mobile         React Native · Expo · TypeScript   (empleado viajero y aprobador)
infra/              docker-compose: PostgreSQL 17, Redis (cola), MinIO (imágenes)
data/eval           set de evaluación del motor
docs/  design/
```

Cada carpeta puede tener su propio `CLAUDE.md` con reglas específicas; se carga al trabajar ahí.

## Arquitectura (12.4)

- La API es un monolito modular: solicitudes, cotizaciones, rendiciones y viáticos, políticas y
  parámetros, auditoría, reportes, administración. Cada módulo es dueño de sus tablas.
- Al cargar un comprobante, la API guarda la imagen y publica un trabajo en la cola (Redis Streams).
  El verificador lo consume, ejecuta el pipeline y devuelve señales, puntaje y decisión.
  La API persiste el resultado. El verificador **no escribe en la base**: solo devuelve resultados.
- Contratos entre partes: `docs/contratos/api.openapi.yaml` (API ↔ web y móvil) y
  `docs/contratos/verifier.schema.json` (API ↔ verificador). **Cambiar un contrato requiere PR
  propio y aviso al equipo.**

## Reglas de negocio transversales

- Políticas de gasto y parámetros del motor son **versiones inmutables**: un cambio cierra la vigente
  e inserta otra. Nunca UPDATE sobre valores de una versión. Cada solicitud guarda la política con la
  que nació y cada verificación, la versión de parámetros que usó.
- Rendición aprobada y conciliación confirmada congelan sus totales.
- No se borran registros con historial (baja lógica).
- El sistema registra adelantos y exporta asientos; **nunca** ejecuta transferencias.
- Montos `numeric(12,2)`, con moneda ISO 4217.

## Seguridad (requisito obligatorio de la cátedra)

- Autenticación con JWT de corta duración y refresh token; contraseñas con argon2.
- Segundo factor (TOTP) obligatorio para Aprobador, Contaduría y Administrador (RN30).
- Autorización por rol en cada endpoint; nunca confiar en el cliente.
- Registro de auditoría de aprobaciones, correcciones y cambios de parámetros (valor anterior y nuevo).
- Imágenes de comprobantes en almacenamiento privado; URLs firmadas de corta duración.
- Secretos solo en variables de entorno (`.env` nunca se commitea).
- Ubicación: solo con consentimiento y solo al capturar un comprobante (Ley 25.326).

## Datos

- Todo dato inventado se marca como **sintético** (columna `origen`, nombre de archivo o README).
  La Mutual AMR es real: nunca presentes datos inventados como suyos.
- No subas fotos de comprobantes con datos personales de terceros sin anonimizar.

## Interfaz

- Estilo elegido: **[COMPLETAR: alto-contraste | neumorfismo]**. Si está sin completar, preguntá
  antes de escribir componentes visuales.
- Reproducí tokens, jerarquía y estados de `design/html/<estilo>/`; no copies el HTML tal cual.
- Accesibilidad: controles reales, etiquetas en inputs, contraste AA, estados que no dependan solo
  del color, objetivos táctiles de 44 px.

## Forma de trabajo

- El equipo programa poco: explicá en lenguaje simple, definí los términos técnicos y no des nada
  por sabido. Si un plan tiene más de 5 pasos, partilo en tareas más chicas.
- Dueños: Juan Cruz (`apps/api`, `infra`, `docs/`), Manu (`services/verifier`, `data/eval`),
  Felipe (`apps/web`, `apps/mobile`, `design/`). Si la tarea requiere tocar carpetas de otro,
  frená y avisá antes de cambiarlas.
- Una sesión = una tarea = una rama = un PR. Ramas `feat/uc02-s08-dhash`, `fix/...`.
- Plan primero: no edites archivos hasta que el plan esté aprobado.
- Código, nombres y commits en inglés; textos de interfaz en español rioplatense.
- Cada regla de negocio y cada señal del motor tiene tests. No hay PR sin tests en verde.
- Si fallás dos veces en lo mismo, frená y explicá qué pasa en vez de seguir probando.
- Al terminar, el usuario va a pedir `/explicar`; la explicación va en la descripción del PR.

## Código y respuestas

Código:
- Nombres descriptivos en inglés; nada de abreviaturas ni `data`, `tmp`, `x`.
- Funciones chicas que hacen una sola cosa; si pasa de ~30 líneas, partila.
- Sin números mágicos: pesos, umbrales y topes salen de parámetros o constantes con nombre.
- Retornos tempranos en vez de if anidados. Sin código comentado ni código muerto.
- Tipado estricto: TypeScript `strict`, type hints en Python.
- Errores explícitos: nunca un catch vacío.
- Lo mínimo que cumpla el caso de uso y sus tests: sin dependencias, abstracciones ni opciones que
  la tarea no pida.
- Máximo 3 parámetros por función; nada de parámetros booleanos que cambian el comportamiento.
- Los mensajes de error dicen qué falló y con qué dato (ej.: "CAE vencido: 2026-10-01 en comprobante 0001-00001234").
- Tests con nombre que describe el caso, estructura preparar-ejecutar-verificar, un concepto por test.

Comentarios:
- Cada archivo empieza con una línea que dice qué hace.
- Cada función pública o señal del motor tiene un docstring corto que cita su regla (RNxx, Sxx o UC-xx).
- Comentá el porqué, no el qué. Nada de comentarios que repiten el código.

Respuestas:
- Cortas: qué hiciste, qué falta y qué tengo que decidir. Sin repetir el código del diff ni resumir
  lo que ya se ve.
- Para leer el documento, buscá la sección en `docs/fuente/etapa3.txt` (grep); no lo leas entero.
