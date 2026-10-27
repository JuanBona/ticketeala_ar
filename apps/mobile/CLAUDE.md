# apps/mobile — aplicación móvil

Dueño: rol Interfaces. Pantallas: `docs/pantallas.md`. Diseño: `design/html/<estilo>/Mobile-*.html`.

- React Native + Expo + TypeScript + Expo Router. Mismos tokens de diseño que la web (paquete
  compartido) y mismo cliente de API.
- Cámara con `expo-camera`; ubicación con `expo-location` **solo si el empleado dio el consentimiento**
  y solo en el momento de capturar el comprobante.
- La carga de comprobante sube la imagen y muestra el resultado de la verificación cuando llega:
  decisión, puntaje y la explicación de cada señal en falla o advertencia (12.5).
- Tokens en almacenamiento seguro (`expo-secure-store`), nunca en texto plano.
- Se prueba en el teléfono con Expo Go durante el desarrollo.
