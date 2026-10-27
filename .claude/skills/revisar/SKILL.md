---
name: revisar
description: Primera revisión de un PR o rama contra la definición de terminado del equipo. Usar cuando el usuario escribe /revisar seguido de un número de PR o nombre de rama.
disable-model-invocation: true
---

Revisá el PR o la rama indicada: $ARGUMENTS. Comparala contra `main`.

Es una ayuda para quien revisa, no la reemplaza. No hagas cambios: solo informá.

Verificá, en este orden, y marcá cada punto como Cumple, No cumple o Revisar a mano:

1. **Alcance.** Hace lo que pide el issue y nada más. Respeta las carpetas del rol (`docs/plan-trabajo.md`).
2. **Reglas.** Respeta el caso de uso en `docs/fuente/etapa3.txt` y `docs/decisiones.md`. Nombrá
   cualquier regla inventada o contradicha.
3. **Tests.** Hay tests para cada regla de negocio o señal nueva. Corrélos y mostrá el resultado.
4. **Contratos.** No cambia `docs/contratos/` sin que el PR lo diga explícitamente.
5. **Seguridad.** Endpoints con guard de rol, auditoría donde corresponde, sin secretos, sin datos
   personales reales, sin SQL armado a mano con datos del usuario.
6. **Datos.** Montos `numeric(12,2)` con moneda; versionado de políticas y parámetros sin UPDATE;
   datos inventados marcados como sintéticos.

Después listá, de mayor a menor gravedad, los problemas concretos con archivo y línea. Cerrá con
dos o tres preguntas que el revisor debería hacerle al autor para confirmar que entiende el código.
