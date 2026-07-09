// Configuración por cada tipo de archivo.
// El hallazgo clave: la columna de proveedor NO se llama igual en cada archivo.
//   PACOM  -> "PROVEEDOR"
//   ROTACIÓN POR CANALES -> "NOMBRE_PROV"
// Cada tipo define qué hoja usar (por nombre, con fallback a la primera) y su columna de proveedor.

export const FILE_TYPES = [
  {
    key: 'PACOM',
    label: 'PACOM',
    icon: 'P',
    description: 'Lista de productos. Divide por columna PROVEEDOR.',
    providerColumn: 'PROVEEDOR',
    sheetHints: ['LISTAS DE PRODUCTOS', 'LISTA DE PRODUCTOS'],
    enabled: true,
  },
  {
    key: 'ROTACION',
    label: 'Rotación por canales',
    icon: 'R',
    description: 'Hoja Export. Divide por columna NOMBRE_PROV.',
    providerColumn: 'NOMBRE_PROV',
    sheetHints: ['Export', 'EXPORT'],
    enabled: true,
  },
  {
    key: 'DESCUENTOS',
    label: 'Descuentos',
    icon: 'D',
    description: 'En configuración. Se habilita al cargar su formato.',
    providerColumn: null,
    sheetHints: [],
    enabled: false,
  },
]

export const getType = (key) => FILE_TYPES.find((t) => t.key === key)
