// Configuración por cada tipo de archivo.
// El hallazgo clave: la columna de proveedor NO se llama igual en cada archivo.
//   PACOM  -> "PROVEEDOR"
//   ROTACIÓN POR CANALES -> "NOMBRE_PROV"
//   DESCUENTOS -> "PROVEEDOR"
// Cada tipo define, en `sheets`, TODAS las hojas que hay que leer del archivo de entrada y
// generar (separadas por proveedor) en el archivo de salida. Cada hoja de salida REFLEJA
// 1:1 las columnas reales del Excel de entrada (mismo nombre, mismo orden) -- no hay listas de
// columnas fijas en el código. Esto es a propósito: antes había listas fijas (ej. la hoja
// DEPURACION de Descuentos) y cuando el proveedor de datos renombraba o agregaba una columna
// (ej. "DCTO SOLICITADO" -> "DCTO"), esa columna quedaba en blanco en la salida SIN NINGÚN
// AVISO -- el bug que se veía como "el descuento sale en cero". Con reflejo dinámico esa clase
// de bug queda eliminada de raíz: la salida siempre trae exactamente lo que trae la entrada.
//
// Exactamente una hoja por tipo debe tener `primary: true`: es la que determina la lista de
// proveedores del archivo (para el cruce contra la base de datos) y la que se puede usar para
// re-detectar la columna de proveedor. Las hojas no-primarias son opcionales: si no existen en
// el archivo de entrada (formato viejo, u hoja que no aplica), se omiten sin error.

// Hoja de confirmación de Descuentos: sigue siendo una PLANTILLA EN BLANCO (notas + fila vacía +
// encabezado + filas vacías) porque el Excel de origen de Descuentos NO trae datos reales en su
// hoja "CONFIRMACION DESCUENTO" -- es un formulario para que el proveedor lo llene después.
const CONFIRMACION_DESCUENTOS = {
  sheet: 'CONFIRMACION DESCUENTO',
  blankBefore: 1,
  headers: [
    { label: 'CODIGO ORACLE', fill: 'green', width: 16 },
    { label: 'DESCRIPCION', fill: 'green', width: 18 },
    { label: 'PROVEEDOR', fill: 'green', width: 16 },
    { label: 'FECHA INICIAL', fill: 'orange', width: 16 },
    { label: 'FECHA HASTA EVACUAR INVENTARIO', fill: 'orange', width: 26 },
    { label: '%DESCUENTO SOLICITADO DEPURACION', fill: 'blue', width: 20 },
  ],
  emptyRows: 2,
}

export const FILE_TYPES = [
  {
    key: 'PACOM',
    label: 'PACOM',
    icon: 'P',
    description: 'Lista de productos. Divide por columna PROVEEDOR.',
    providerColumn: 'PROVEEDOR',
    flag: 'envia_pacom',
    ccField: 'cc_pacom',
    sheetHints: ['LISTAS DE PRODUCTOS', 'LISTA DE PRODUCTOS'],
    enabled: true,
    multiSheet: true, // salida de formato fijo (varias hojas) -> sin selector de columnas en la UI
    sheets: [
      // La hoja "CONFIRMACION DESCUENTO" del PACOM ahora trae datos reales por proveedor
      // (Actividad, Código, Descripción, Proveedor, Macrocategoria, Descuento minimo, más las
      // columnas que el proveedor llena: FECHA INICIAL/FINAL, DIAS PARTICULARES, %DESCUENTO).
      // Antes esta hoja se generaba con una plantilla fija en blanco que IGNORABA por completo
      // estos datos de entrada; ahora se separa por proveedor igual que la lista de productos.
      { key: 'confirmacion', outputName: 'CONFIRMACION DESCUENTO', sheetHints: ['CONFIRMACION DESCUENTO'] },
      { key: 'productos', outputName: 'LISTAS DE PRODUCTOS', sheetHints: ['LISTAS DE PRODUCTOS', 'LISTA DE PRODUCTOS'], primary: true },
    ],
  },
  {
    key: 'ROTACION',
    label: 'Rotación por canales',
    icon: 'R',
    description: 'Hoja Export. Divide por columna NOMBRE_PROV.',
    providerColumn: 'NOMBRE_PROV',
    flag: 'envia_rotacion',
    ccField: 'cc_rotacion',
    sheetHints: ['Export', 'EXPORT'],
    enabled: true,
    sheets: [
      { key: 'export', outputName: 'Datos', sheetHints: ['Export', 'EXPORT'], primary: true },
    ],
  },
  {
    key: 'DESCUENTOS',
    label: 'Descuentos',
    icon: 'D',
    description: 'Una hoja con todos los proveedores. Salida: hojas por proveedor (confirmación + depuración + próximos a vencer).',
    providerColumn: 'PROVEEDOR',
    flag: 'envia_descuentos',
    ccField: 'cc_descuentos',
    sheetHints: ['DEPURACION', 'CONFIRMACION DESCUENTO'],
    enabled: true,
    multiSheet: true,
    confirmacion: CONFIRMACION_DESCUENTOS, // formulario en blanco (sin datos reales de entrada)
    sheets: [
      // DEPURACION es la hoja de datos real (SKU, DESCRIPCION, MUNDO, MACROCATEGORIA,
      // PROVEEDOR, DCTO, INV TOTAL, VR INVENTARIO, NOVEDAD -- reflejadas tal cual vienen).
      // totalColumn agrega, arriba del encabezado, la fila con el total en pesos (como el
      // formato original) -- se calcula sobre la columna que exista en el archivo real.
      { key: 'depuracion', outputName: 'DEPURACION', sheetHints: ['DEPURACION'], primary: true, totalColumn: 'VR INVENTARIO' },
      // "PROXIMOS A VENCER" es una hoja nueva (no todos los archivos la traen: opcional).
      { key: 'proximos', outputName: 'PROXIMOS A VENCER', sheetHints: ['PROXIMOS A VENCER'] },
    ],
  },
]

export const getType = (key) => FILE_TYPES.find((t) => t.key === key)
