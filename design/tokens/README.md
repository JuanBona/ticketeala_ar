# Tokens de diseño (`@amr-viajes/design-tokens`)

Un **token de diseño** es un valor del estilo visual con nombre propio: en vez de escribir
`#C8F05A` o `16px` sueltos en cada pantalla, se escribe `colors.accent` o `radii.field`. Si un
valor cambia, se cambia acá y lo toman la web y el móvil a la vez.

Los valores salen del estilo **alto-contraste** (`design/html/alto-contraste/`): se tomaron los
que más se repiten en el HTML de referencia y se les puso un nombre según lo que hacen en pantalla.

## Qué hay

| Archivo | Qué define |
|---|---|
| `src/colors.ts` | 18 colores por rol (`ink`, `canvas`, `accent`, `alert`…) y los pares texto/fondo permitidos |
| `src/typography.ts` | Familias (Bricolage, Geist, Geist Mono), tamaños y 13 estilos de texto (`display`, `body`, `eyebrow`, `amount`…) |
| `src/layout.ts` | Escala de espaciado (pasos de 4 px), radios, bordes y alturas mínimas (44 px táctiles) |
| `src/shadows.ts` | Sombras duras (botones) y suaves (tarjetas, hojas) |
| `src/motion.ts` | Duraciones y curvas de animación, y su versión con movimiento reducido |
| `src/css-variables.ts` | Genera `tokens.css` con variables CSS para la web |
| `tokens.css` | Generado: **no se edita a mano** |

## Cómo se usa

- **Web (`apps/web`):** importar `@amr-viajes/design-tokens/tokens.css` una vez y usar las
  variables: `color: var(--color-ink); border-radius: var(--radius-field)`.
- **Móvil (`apps/mobile`):** importar los objetos: `import { colors, radii } from '@amr-viajes/design-tokens'`.
  `toBoxShadow()` sirve para la propiedad `boxShadow` de React Native 0.76 o posterior.

Las dos apps lo instalan como dependencia local (`"file:../../design/tokens"`); se configura en la
tarea de componentes base.

## Reglas

- **Contraste AA:** solo se usan las combinaciones de `allowedTextPairs`; un test mide que todas
  lleguen a 4,5:1. El naranja `alert` nunca va como texto sobre fondo claro (da 2,67:1): se usa
  como fondo con texto `ink`, o `alertOnInk` sobre fondo oscuro.
- **Animaciones:** el HTML de referencia no tiene; las duraciones y curvas las definió el equipo
  (curvas de Material Design 3). Ninguna pasa de medio segundo, y con "reducir movimiento"
  todas quedan en 0 (`reducedMotion` en el móvil; `prefers-reduced-motion` en `tokens.css`).
- **Fuentes:** los archivos están en `design/html/fonts/`. Plex Mono y Nunito son del estilo
  neumorfismo, que se descartó: no se usan.

## Comandos

```bash
npm install
npm test             # 40 tests: contraste, tamaños, sombras, animaciones y tokens.css al día
npm run typecheck
npm run build:css    # regenera tokens.css después de cambiar un token
```
