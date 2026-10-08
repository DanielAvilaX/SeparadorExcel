// Configuraciones "de fábrica". Cada usuario puede editarlas (sus cambios se guardan como
// versiones propias en la base, ver src/lib/configs.js); esta es siempre la "versión original" a
// la que se puede volver.
//
// `builtinFlag` / `builtinCcField`: columnas de la tabla providers que ya existían para estos 3
// tipos (quién lo recibe y su copia CC). Las configuraciones nuevas usan provider_config_settings.

export const BUILTIN_CONFIGS = [
  {
    key: 'PACOM',
    label: 'PACOM',
    icon: 'P',
    description: 'Lista de productos. Divide por columna PROVEEDOR.',
    builtinFlag: 'envia_pacom',
    builtinCcField: 'cc_pacom',
    definition: {
      email: true,
      split: { by: 'column', column: 'PROVEEDOR', size: 1000 },
      output: 'files',
      filters: [],
      sheets: [
        // Desde septiembre llega como "CONFIRMACION DESCUENTOS" (plural) y a veces sin la hoja de
        // productos aparte -- se aceptan ambos nombres.
        { type: 'data', name: 'CONFIRMACION DESCUENTO', source: ['CONFIRMACION DESCUENTO', 'CONFIRMACION DESCUENTOS'], fallback: 'none', optional: true, headerRow: null, columns: null, total: null },
        { type: 'data', name: 'LISTAS DE PRODUCTOS', source: ['LISTAS DE PRODUCTOS', 'LISTA DE PRODUCTOS'], fallback: 'first', optional: false, headerRow: null, columns: null, total: null },
      ],
    },
  },
  {
    key: 'ROTACION',
    label: 'Rotación por canales',
    icon: 'R',
    description: 'Hoja Export. Divide por columna NOMBRE_PROV.',
    builtinFlag: 'envia_rotacion',
    builtinCcField: 'cc_rotacion',
    definition: {
      email: true,
      split: { by: 'column', column: 'NOMBRE_PROV', size: 1000 },
      output: 'files',
      filters: [],
      sheets: [
        { type: 'data', name: 'Datos', source: ['Export'], fallback: 'first', optional: false, headerRow: null, columns: null, total: null },
      ],
    },
  },
  {
    key: 'DESCUENTOS',
    label: 'Descuentos',
    icon: 'D',
    description: 'Una hoja con todos los proveedores. Salida: confirmación + depuración + próximos a vencer.',
    builtinFlag: 'envia_descuentos',
    builtinCcField: 'cc_descuentos',
    definition: {
      email: true,
      split: { by: 'column', column: 'PROVEEDOR', size: 1000 },
      output: 'files',
      filters: [],
      sheets: [
        // Formulario en blanco: el Excel de origen no trae datos para esta hoja, la llena el proveedor.
        {
          type: 'form',
          name: 'CONFIRMACION DESCUENTO',
          notes: [],
          blankBefore: 1,
          headers: [
            { label: 'CODIGO ORACLE', fill: 'FF00B050', width: 16 },
            { label: 'DESCRIPCION', fill: 'FF00B050', width: 18 },
            { label: 'PROVEEDOR', fill: 'FF00B050', width: 16 },
            { label: 'FECHA INICIAL', fill: 'FFFFC000', width: 16 },
            { label: 'FECHA HASTA EVACUAR INVENTARIO', fill: 'FFFFC000', width: 26 },
            { label: '%DESCUENTO SOLICITADO DEPURACION', fill: 'FFB4C7E7', width: 20 },
          ],
          staticRows: [],
          emptyRows: 2,
        },
        { type: 'data', name: 'DEPURACION', source: ['DEPURACION'], fallback: 'first', optional: false, headerRow: null, columns: null, total: 'VR INVENTARIO' },
        { type: 'data', name: 'PROXIMOS A VENCER', source: ['PROXIMOS A VENCER'], fallback: 'none', optional: true, headerRow: null, columns: null, total: null },
      ],
    },
  },
]

export const getBuiltin = (key) => BUILTIN_CONFIGS.find((c) => c.key === key) || null

// Definición vacía para una configuración nueva / el Separador express.
export function emptyDefinition() {
  return {
    email: false,
    split: { by: 'column', column: '', size: 1000 },
    output: 'files',
    filters: [],
    sheets: [],
  }
}
