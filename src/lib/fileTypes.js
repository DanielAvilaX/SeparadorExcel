// Configuración por cada tipo de archivo.
// El hallazgo clave: la columna de proveedor NO se llama igual en cada archivo.
//   PACOM  -> "PROVEEDOR"
//   ROTACIÓN POR CANALES -> "NOMBRE_PROV"
//   DESCUENTOS -> "PROVEEDOR"
// Cada tipo define qué hoja usar (por nombre, con fallback a la primera), su columna
// de proveedor y, si aplica, la hoja "CONFIRMACION DESCUENTO" que se agrega a la salida.

// Hoja de confirmación del PACOM: 2 notas + encabezado + filas fijas PACOM / DESCUENTO POS
const CONFIRMACION_PACOM = {
  sheet: 'CONFIRMACION DESCUENTO',
  notes: [
    '*Agradecemos su apoyo con la particpacion  de acuerdo a las categorias seleccionadas para cada una de las actividades, según el pacom (hoja 1)',
    '*Agradecemos su apoyo con la particpacion en las actividades por marcas de productos',
  ],
  headers: [
    { label: 'PACOM/ DESCUENTO POS', fill: 'green', width: 22 },
    { label: 'ACTIVIDAD', fill: 'green', width: 30 },
    { label: 'CODIGO ORACLE', fill: 'green', width: 16 },
    { label: 'DESCRIPCION', fill: 'green', width: 16 },
    { label: 'PROVEEDOR', fill: 'green', width: 16 },
    { label: 'DIAS PARTICULARES DEL MES', fill: 'orange', width: 26 },
    { label: '%DESCUENTO PROVEEDOR', fill: 'blue', width: 18 },
  ],
  staticRows: [['PACOM'], ['DESCUENTO POS']],
}

// Hoja de confirmación de Descuentos: 1 fila en blanco + encabezado + filas vacías
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
    sheetHints: ['LISTAS DE PRODUCTOS', 'LISTA DE PRODUCTOS'],
    enabled: true,
    confirmacion: CONFIRMACION_PACOM,
    dataSheet: 'LISTAS DE PRODUCTOS',
  },
  {
    key: 'ROTACION',
    label: 'Rotación por canales',
    icon: 'R',
    description: 'Hoja Export. Divide por columna NOMBRE_PROV.',
    providerColumn: 'NOMBRE_PROV',
    flag: 'envia_rotacion',
    sheetHints: ['Export', 'EXPORT'],
    enabled: true,
  },
  {
    key: 'DESCUENTOS',
    label: 'Descuentos',
    icon: 'D',
    description: 'Una hoja con todos los proveedores. Salida: 2 hojas por proveedor.',
    providerColumn: 'PROVEEDOR',
    flag: 'envia_descuentos',
    sheetHints: ['DEPURACION', 'CONFIRMACION DESCUENTO'],
    enabled: true,
    confirmacion: CONFIRMACION_DESCUENTOS,
    // Salida especial replicando el FORMATO DESCUENTO
    output: {
      mode: 'descuentos',
      totalColumn: 'VR INVENTARIO',
      depuracionSheet: 'DEPURACION',
      depuracionColumns: ['Articulo', 'Descripcion', 'MUNDO', 'MACROCATEGORIA', 'PROVEEDOR', 'DCTO SOLICITADO', 'VR INVENTARIO', 'NOVEDAD'],
    },
  },
]

export const getType = (key) => FILE_TYPES.find((t) => t.key === key)
