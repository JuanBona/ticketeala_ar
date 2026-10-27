# Casos de uso y alcance del prototipo

Fuente: catálogo del punto 12.3 de `docs/fuente/etapa3.pdf`. Para implementar un caso, leé su
especificación completa en el PDF (camino básico, caminos alternativos, reglas de negocio).

Columna **Prototipo**: qué se entrega el 18/12/2026.
- **Completo**: camino básico y caminos alternativos principales.
- **Básico**: camino básico; los alternativos quedan documentados como pendientes.
- **Mínimo**: lo necesario para que los otros casos funcionen (datos de semilla, pantallas simples).

| Caso | Actor | Prototipo | Dueño | Iteración | Pantallas |
|---|---|---|---|---|---|
| UC-02 Cargar y verificar comprobante | Empleado | **Completo** (S01–S11; S12 con historial sintético) | Motor + API + Interfaces | 0 (PoC) y 2 | Mobile-OCR, Mobile-Rendicion |
| UC-01 Solicitar y aprobar viaje | Empleado | Completo | API + Interfaces | 1 | Mobile-Solicitud, Mobile-Viajes, Mobile-Aprobar, Main (bandeja) |
| UC-03 Cotizar servicios de viaje | Asesor AMR Turismo | Básico | API + Interfaces | 2 | **Falta diseñar**: bandeja y carga de cotizaciones; comparativo en la app |
| UC-04 Presentar y aprobar rendición | Empleado / Contaduría | Completo | API + Interfaces | 3 | Mobile-Rendicion, Contaduria-Rendicion |
| UC-05 Revisar comprobantes en alerta | Contaduría | Completo | API + Interfaces | 3 | Contaduria-Rendicion (adaptar a bandeja por puntaje) |
| UC-06 Liquidar y conciliar viático | Contaduría | Básico (adelanto, liquidación, exportar CSV) | API + Interfaces | 3 | Conciliacion |
| UC-07 Configurar políticas y parámetros | Contaduría / RRHH | Completo para políticas; básico para parámetros | API + Interfaces | 2 | Politicas; **falta diseñar** la pestaña de parámetros |
| UC-08 Consultar tableros de gestión | Gerencia | Completo (requisito obligatorio de la cátedra) | API + Interfaces | 3 | Main, Reportes |
| UC-09 Evaluar y recalibrar el motor | Contaduría | Básico (reporte de evaluación; recalibración propuesta y aprobada a mano) | Motor + Interfaces | 4 | **Falta diseñar**: "Desempeño del motor" |
| UC-10 Administrar usuarios, roles y maestros | Administrador | Mínimo (semilla + alta de empleado y roles) | API + Interfaces | 1 | Maestros |
| Seguridad (O9, transversal) | Todos | Completo: login, JWT, roles, TOTP (RN30), auditoría | API | 1 y 4 | Login, Mobile-Login, Mobile-Consentimiento |

Si el tiempo no alcanza, se recorta en este orden (de lo primero que se saca a lo último):
UC-09 recalibración → UC-06 exportación → UC-03 cotización externa → UC-10 más allá de la semilla.
**Nunca se recortan** UC-02, UC-08 ni la seguridad: son el núcleo técnico y los dos requisitos
obligatorios de la cátedra.
