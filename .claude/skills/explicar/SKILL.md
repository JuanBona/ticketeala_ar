---
name: explicar
description: Explica la tarea recién terminada para alguien que programa poco, antes de abrir el PR. Usar cuando el usuario escribe /explicar.
disable-model-invocation: true
---

Explicá lo que hiciste en esta sesión para alguien que sabe poco de programación. En español
rioplatense, sin jerga innecesaria, y si usás un término técnico, definilo en una línea.

1. **Qué resuelve.** Qué problema resuelve y qué caso de uso, regla de negocio (RNxx) o señal del
   motor (Sxx) implementa. Citá la sección de `docs/fuente/etapa3.txt` o la decisión de
   `docs/decisiones.md` en la que te basaste.
2. **Archivos.** Qué archivos creaste o cambiaste y para qué sirve cada uno, en una línea por archivo.
3. **Cómo probarlo.** Qué verifican los tests, cómo correrlos y, si aplica, cómo probarlo a mano.
4. **Decisiones propias.** Qué decidiste que no estaba en el pedido ni en los documentos. Si alguna
   debería consultarse con el equipo, decilo.
5. **Para la defensa.** Tres preguntas que podría hacer el tribunal sobre esto, con su respuesta.

Terminá con un bloque titulado "Para la descripción del PR" con un resumen de 3 a 5 líneas listo
para pegar.
