# apps/web — aplicación web

Dueño: rol Interfaces. Pantallas: `docs/pantallas.md`. Diseño: `design/html/<estilo>/`.

- React + TypeScript + Vite + React Router + TanStack Query. Cliente de API generado desde
  `docs/contratos/api.openapi.yaml`; mientras la API no esté, servidor de prueba con MSW.
- Primero los tokens de diseño (colores, tipografías, radios, sombras, espaciado) en un solo archivo,
  extraídos del HTML de referencia. Después los componentes base (botón, input, tarjeta, chip,
  tabla, barra de navegación). Recién después las pantallas.
- Los tableros de UC-08 se construyen con datos del sistema, con filtros de período, área, destino y
  categoría, y exportación a planilla.
- Cada pantalla respeta los roles: lo que el usuario no puede hacer no se muestra.
- Tests de componentes con Vitest + Testing Library; un test de punta a punta con Playwright por
  caso de uso completo.
