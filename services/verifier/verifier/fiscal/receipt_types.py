"""Códigos de ARCA del tipo de comprobante que cuentan como clase A para S06 (D18, D32, D38).

Fuente: ARCA, "Tablas del SISTEMA" del Libro IVA Digital, punto 3 "Tipo de Comprobante"
(https://www.afip.gob.ar/iva/documentos/Libro-IVA-Digital-Tablas-del-Sistema.pdf, PDF del
26/02/2025). Filas usadas, tal como figuran (la tabla lleva ceros a la izquierda; acá van sin
ellos, como tipoCmp del QR y D32):

    001  FACTURAS A
    002  NOTAS DE DEBITO A
    003  NOTAS DE CREDITO A
    004  RECIBOS A
    005  NOTAS DE VENTA AL CONTADO A
    081  TIQUE FACTURA A CONTROLADORES FISCALES
    112  TIQUE NOTA DE CREDITO A
    115  TIQUE NOTA DE DEBITO A
    201  FACTURA DE CRÉDITO ELECTRÓNICA MIPYMES (FCE) A
    202  NOTA DE DÉBITO ELECTRÓNICA MIPYMES (FCE) A
    203  NOTA DE CRÉDITO ELECTRÓNICA MIPYMES (FCE) A

Son los comprobantes clase A con IVA discriminado que puede rendir un viajero. Quedan afuera:
- las liquidaciones y comprobantes sectoriales clase A (pesca, granos, tabaco, avícola, pecuario,
  ej.: 023, 024, 027, 060, 063, 150, 157);
- 017 (liquidación de servicios públicos clase A);
- 034 y 039 (comprobantes A genéricos de la R.G. 1415, sin un formato fijo de conceptos);
- la clase M (051 a 059 y 118 a 120): D18 habla de factura A.
"""

CLASS_A_CODES: frozenset[str] = frozenset(
    {"1", "2", "3", "4", "5", "81", "112", "115", "201", "202", "203"}
)
