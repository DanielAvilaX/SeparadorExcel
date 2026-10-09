// Contenido de la Ayuda. Cada sección es una "página" con bloques:
//   { p }                     párrafo (admite **negrita**)
//   { h }                     subtítulo
//   { steps: [] }             pasos numerados
//   { list: [] }              viñetas
//   { note, title, tone }     recuadro de aviso ('info' | 'warn')
//   { shot, caption, legend } captura (src/assets/help/<shot>.jpg) con la explicación de cada
//                             número marcado en rojo. Las marcas las genera scripts/capture-help.cjs:
//                             si se cambia una marca allá, hay que ajustar la leyenda acá.
//   { table: { head: [], rows: [[]] } }

export const HELP_GROUPS = [
  { title: 'Primeros pasos', ids: ['bienvenida', 'sesion', 'panel'] },
  { title: 'Separar y enviar', ids: ['procesar-cargar', 'procesar-revisar', 'procesar-enviar', 'express'] },
  { title: 'Configurar la app', ids: ['separaciones', 'separaciones-reglas', 'separaciones-hojas', 'separaciones-versiones', 'proveedores', 'cc', 'plantilla', 'configuracion', 'actualizaciones'] },
  { title: 'Si algo sale mal', ids: ['problemas', 'preguntas'] },
]

export const HELP_SECTIONS = [
  {
    id: 'bienvenida',
    title: '¿Qué hace esta aplicación?',
    blocks: [
      { p: 'Separador & Envío toma un Excel grande que trae información de muchos proveedores (PACOM, Rotación por canales, Descuentos o cualquier otro reporte) y lo divide en **un archivo por proveedor**. Después, si quieres, le envía a cada proveedor su archivo por correo desde **tu Outlook**, con la plantilla de correo y las copias (CC) que tengas configuradas.' },
      { h: 'El recorrido normal' },
      { steps: [
        'En **Procesar archivo** eliges el tipo de archivo y lo cargas.',
        'La app separa las filas por proveedor y las cruza con tu lista de **Proveedores** para saber a quién se le puede enviar.',
        'Revisas el resumen: quién recibe correo, quién no y por qué.',
        'Descargas los archivos separados o los envías por correo con un clic.',
      ] },
      { h: 'Lo que se configura una sola vez' },
      { list: [
        '**Proveedores**: nombre y correos de cada proveedor, y a cuáles tipos de archivo participa.',
        '**Copias (CC)**: grupos de correos que van en copia.',
        '**Plantilla**: el asunto y el texto del correo.',
        '**Separaciones**: cómo se separa cada tipo de archivo (ya vienen listas PACOM, Rotación y Descuentos).',
      ] },
      { note: 'Todo lo que configuras (proveedores, copias, plantillas, separaciones) es **solo de tu cuenta**: otra persona que use la app con su propio usuario no lo ve ni lo puede cambiar.', tone: 'info' },
      { note: 'Para enviar correos, **Outlook de escritorio** debe estar instalado y con tu cuenta abierta en este equipo. Para solo separar y descargar no hace falta Outlook.', tone: 'warn', title: 'Antes de enviar' },
      { p: 'Usa el índice de la izquierda o los botones **Anterior** y **Siguiente** para moverte por esta guía. En cada captura, los recuadros rojos numerados corresponden a la explicación que está debajo.' },
    ],
  },
  {
    id: 'sesion',
    title: 'Iniciar sesión y crear tu cuenta',
    blocks: [
      { p: 'La primera pantalla pide tu correo y tu contraseña. La sesión queda guardada: la próxima vez que abras la app entras directo, hasta que le des **Salir** en el panel lateral.' },
      { shot: 'login', caption: 'Pantalla de inicio de sesión', legend: {
        1: 'Tu correo (el mismo con el que creaste la cuenta).',
        2: 'Tu contraseña.',
        3: '**Ingresar**: entra a la aplicación.',
        4: '**Regístrate**: si todavía no tienes cuenta, cambia el formulario para crear una (correo, contraseña y confirmación de la contraseña).',
      } },
      { note: 'Si al crear la cuenta aparece "Revisa tu correo y confirma tu cuenta", abre el correo que te llegó, confirma y luego ingresa con tu correo y contraseña.', tone: 'info' },
      { p: 'Una cuenta nueva empieza vacía: sin proveedores ni plantillas propias. Las configuraciones de separación de fábrica (PACOM, Rotación y Descuentos) sí vienen listas.' },
    ],
  },
  {
    id: 'panel',
    title: 'El panel lateral',
    blocks: [
      { p: 'El panel de la izquierda es el menú principal de la app. Desde ahí cambias de pantalla en cualquier momento: el archivo que cargaste en Procesar y un envío en curso **no se pierden** al cambiar de pantalla.' },
      { shot: 'panel-lateral', caption: 'Panel lateral', legend: {
        1: 'Las pantallas de la app: Procesar archivo, Separador express, Separaciones, Proveedores, Copias (CC), Plantilla, Configuración y esta Ayuda. La pantalla abierta se ve resaltada en verde.',
        2: 'Colapsa el panel para ganar espacio (queda solo con los íconos). Vuelve a hacer clic para expandirlo.',
        3: 'Tu nombre y foto (se cambian en Configuración).',
        4: '**Salir**: cierra tu sesión en este equipo.',
        5: 'La versión instalada de la app. Sirve para saber si tienes la última.',
      } },
      { shot: 'panel-colapsado', caption: 'Panel colapsado', legend: {
        1: 'Con el panel colapsado, pasa el mouse sobre cada ícono para ver el nombre de la pantalla.',
      } },
    ],
  },
  {
    id: 'procesar-cargar',
    title: 'Procesar archivo: elegir el tipo y cargarlo',
    blocks: [
      { p: 'Es la pantalla principal. Aquí separas un archivo y, si corresponde, lo envías por correo.' },
      { shot: 'procesar-tipo', caption: 'Paso 1 y 2: tipo de archivo y carga', legend: {
        1: 'Elige qué archivo vas a procesar. Aparecen las configuraciones de fábrica (PACOM, Rotación por canales, Descuentos) y las que tú hayas creado en **Separaciones**. Cada una sabe qué hojas leer, por qué columna separar y qué hojas genera.',
        2: 'Arrastra el Excel aquí o haz clic para buscarlo. Se aceptan .xlsx y .xls. Mientras lee verás una barra de porcentaje; los archivos grandes (como Rotación) pueden tardar unos segundos.',
      } },
      { note: 'Si te equivocaste de tipo, solo elige el correcto arriba: el archivo **no se vuelve a subir**, la app lo recalcula sola.', tone: 'info' },
      { shot: 'procesar-archivo', caption: 'Archivo cargado', legend: {
        1: 'El archivo cargado: nombre, tipo y tamaño.',
        2: '**Reemplazar** carga otro archivo en su lugar; **Eliminar** lo quita.',
        3: 'La columna por la que se separa (por ejemplo PROVEEDOR) y qué versión de la configuración se está usando ("original" o v2, v3...).',
        4: 'Prefijo opcional para el nombre de los archivos. Ejemplo: con "Octubre_" el archivo de 3M sale como "Octubre_3M COLOMBIA SA.xlsx".',
        5: 'Columnas que llevará cada archivo (solo aparece cuando el tipo tiene una sola hoja de datos con todas sus columnas).',
      } },
      { h: 'Quitar columnas solo para esta vez' },
      { shot: 'procesar-columnas', caption: 'Elegir columnas de una corrida (ejemplo con Rotación)', legend: {
        1: 'Cada etiqueta es una columna del archivo. En verde con check: se incluye. En amarillo: no se incluye.',
        2: 'Haz clic en una columna para quitarla o volver a ponerla. En este ejemplo se quitaron CanalVenta y MUNDO.',
        3: 'Marca o desmarca todas las columnas de una vez.',
      } },
      { note: 'Esta elección vale solo para el archivo que estás procesando. Para cambiar las columnas de forma permanente, edita la configuración en **Separaciones**.', tone: 'info' },
    ],
  },
  {
    id: 'procesar-revisar',
    title: 'Procesar archivo: revisar antes de enviar',
    blocks: [
      { p: 'Apenas carga el archivo, la app muestra qué va a generar y cruza los proveedores del archivo con tu lista de **Proveedores**. El cruce no distingue mayúsculas ni espacios de más: "Abbott  s.a.s" y "ABBOTT S.A.S" son el mismo proveedor.' },
      { shot: 'procesar-revision', caption: 'Resumen y cruce con la base', legend: {
        1: 'Cuántos archivos se generan, cuántos grupos (proveedores) hay y cuántas filas toma de cada hoja del Excel. Debajo se avisa si alguna hoja de salida no se genera porque el archivo no la trae.',
        2: 'Filas que no tienen proveedor (celda vacía o con 0). No van en ningún archivo; el aviso te dice cuántas son para que lo revises en el Excel original.',
        3: '**Recibirán correo**: están en tu lista, activos, con correo y participan en este tipo. Pasa el mouse sobre uno para ver a qué correos va y con qué copia (CC).',
        4: '**Sin correo en la base**: no están en tu lista, están inactivos o no tienen correo. Pasa el mouse para ver el motivo. A estos **no** se les envía.',
      } },
      { shot: 'procesar-revision-2', caption: 'Excluidos, plantilla y botones finales', legend: {
        1: 'Recordatorio: los de "Sin correo" no reciben nada. Agrégalos en Proveedores y vuelve: la lista se recalcula sin volver a subir el archivo.',
        2: '**No participan**: están en tu lista pero los apagaste para este tipo de archivo (en Proveedores, en la pestaña del tipo). Haz clic para ver quiénes son.',
        3: 'La plantilla de correo que se va a usar. Haz clic en otra para cambiarla; pasa el mouse para ver su contenido.',
        4: '**Descargar**: baja un ZIP con un Excel por proveedor (todos, tengan o no correo). No envía nada.',
        5: '**Enviar N correos**: envía a cada proveedor de la columna verde su archivo adjunto.',
      } },
      { note: 'Cada archivo generado conserva el **formato y el estilo del Excel original**: porcentajes (20%), moneda, fechas, colores de encabezados y anchos de columna. La app no cambia ni adivina formatos.', tone: 'info' },
    ],
  },
  {
    id: 'procesar-enviar',
    title: 'Procesar archivo: enviar los correos',
    blocks: [
      { shot: 'enviar-confirmar', caption: 'Confirmación antes de enviar', legend: {
        1: 'Antes de enviar, la app te dice cuántos correos van a salir y con qué plantilla.',
        2: 'Confirma para empezar. Si algo no está bien, cancela y revisa.',
      } },
      { h: 'Durante el envío' },
      { shot: 'enviar-progreso', caption: 'Ventana de progreso', legend: {
        1: 'Barra de avance.',
        2: 'Cuántos correos van del total y el porcentaje.',
        3: 'A qué proveedor se le está enviando en este momento.',
        4: '**Cancelar envío**: detiene el envío después del correo en curso (ninguno queda a medias). Los que ya salieron no se pueden deshacer.',
      } },
      { note: 'La ventana de progreso cubre la app a propósito, para que un clic accidental no interrumpa el envío. Puedes seguir trabajando en otros programas.', tone: 'info' },
      { p: 'Los correos salen **pausados a propósito**: unos segundos entre uno y otro, y una pausa más larga cada 40, para que Microsoft no bloquee tu cuenta por envío masivo. Como referencia:' },
      { table: { head: ['Cantidad', 'Tiempo aproximado'], rows: [['25 correos', '1 minuto'], ['75 correos', '3 minutos'], ['150 correos', '9 minutos']] } },
      { h: 'Al terminar' },
      { shot: 'enviar-resumen', caption: 'Resumen del envío', legend: {
        1: '**Enviados**: a quiénes sí les salió el correo.',
        2: '**No enviados**: a quiénes no y por qué (pasa el mouse sobre cada uno). Si cancelaste, los que faltaban aparecen como "no alcanzado".',
        3: 'Cierra el resumen y vuelve a la pantalla.',
      } },
      { p: 'También puedes comprobar los correos en la carpeta **Elementos enviados** de tu Outlook.' },
    ],
  },
  {
    id: 'express',
    title: 'Separador express',
    blocks: [
      { p: 'Sirve para separar **cualquier Excel una sola vez**, sin enviar correos y sin guardar nada. Es útil para reportes que llegan de vez en cuando y que no vale la pena configurar.' },
      { shot: 'express-vacio', caption: 'Cargar el archivo', legend: {
        1: 'Arrastra o elige el Excel. La app revisa todas sus hojas y columnas y propone una separación: si encuentra una columna de proveedor, separa por ella.',
      } },
      { h: '1. Cómo se separa' },
      { shot: 'express-separar', caption: 'Forma de separar y resultado', legend: {
        1: '**Por columna**: un grupo por cada valor distinto de la columna (por ejemplo, un grupo por proveedor). **Por cantidad de filas**: grupos de N filas (Parte 1, Parte 2...). **Sin separar**: todo en un solo archivo, útil para filtrar o reorganizar hojas y columnas.',
        2: 'La columna por la que se separa. Debajo se indica cuántos valores distintos tiene.',
        3: '**Un archivo por grupo** (todos dentro de un ZIP), **un archivo con una pestaña por grupo**, o **un solo archivo con todo**.',
      } },
      { h: '2. Filtrar filas (opcional)' },
      { shot: 'express-filtros', caption: 'Filtros', legend: {
        1: 'Agrega una condición.',
        2: '**Incluir solo filas donde** o **Excluir filas donde**.',
        3: 'La columna que se revisa.',
        4: 'La condición: es igual a, es distinto de, contiene, no contiene, es uno de (varios valores separados por ;), está vacío, no está vacío, es mayor que, es menor que.',
        5: 'El valor a comparar. Para porcentajes puedes escribir 15% o 0,15.',
        6: 'Quita el filtro.',
      } },
      { p: 'En el ejemplo se excluyen las filas de la actividad "Descuentos de miedo" y se dejan solo las de descuento mínimo mayor a 15%. Los filtros no distinguen mayúsculas, y cada uno aplica a las hojas que tengan esa columna.' },
      { h: '3. Hojas de cada archivo' },
      { shot: 'express-hojas', caption: 'Hojas de salida', legend: {
        1: 'Agrega una hoja con datos del Excel o una hoja formulario en blanco (ver la sección **Separaciones: hojas de cada archivo**).',
        2: 'El nombre de la pestaña en el archivo que se genera.',
        3: 'Cambia el orden de las pestañas.',
        4: 'De qué hoja del Excel se toman los datos.',
        5: 'Qué hacer si el archivo no trae esa hoja: usar la primera hoja libre, u omitirla sin error.',
        6: 'Fila del encabezado (la app la encuentra sola) y fila de total opcional arriba del encabezado.',
      } },
      { h: '4. Resultado y descarga' },
      { shot: 'express-resultado', caption: 'Qué grupos generar', legend: {
        1: 'Cuántos archivos y grupos salen y cuántas filas quedan después de los filtros.',
        2: 'Marca **todos** o **ninguno** de una vez.',
        3: 'Haz clic en un grupo para dejarlo fuera (queda en gris). En el ejemplo se excluyeron dos proveedores.',
      } },
      { shot: 'express-descargar', caption: 'Descargar o guardar como configuración', legend: {
        1: 'Prefijo opcional para el nombre de los archivos.',
        2: '**Descargar**: baja el ZIP (o el archivo único).',
        3: 'Si vas a repetir esta separación, escribe un nombre...',
        4: '...y dale **Guardar configuración**. Queda en Separaciones y aparece como un tipo más en Procesar archivo.',
      } },
    ],
  },
  {
    id: 'separaciones',
    title: 'Separaciones: la lista de configuraciones',
    blocks: [
      { p: 'Una **configuración de separación** le dice a la app cómo tratar un tipo de archivo: qué hojas leer, por qué columna separar, qué filas dejar y qué hojas y columnas lleva cada archivo generado. Las de fábrica son PACOM, Rotación por canales y Descuentos; puedes editarlas y crear las tuyas.' },
      { shot: 'separaciones-lista', caption: 'Lista y datos generales', legend: {
        1: 'Tus configuraciones. Dice si es de fábrica o propia, su versión actual y si envía correos. Haz clic en una para editarla.',
        2: 'Crea una configuración nueva.',
        3: 'Nombre e ícono (una o dos letras) con que aparece en Procesar archivo.',
        4: 'Descripción que se ve debajo del nombre al elegir el tipo de archivo.',
        5: 'Solo en las de fábrica: **Restablecer original** las deja como venían. En las propias, en este lugar aparece **Eliminar**.',
      } },
      { shot: 'separaciones-ejemplo', caption: 'Excel de ejemplo', legend: {
        1: 'Sube un **Excel de ejemplo** del reporte. No se guarda: sirve para elegir hojas y columnas de una lista y para ver el resultado antes de guardar.',
        2: 'Las mismas opciones del Separador express (ver la siguiente sección).',
        3: '**Usar para enviar correos**: la configuración queda disponible para enviar a proveedores. Requiere separar por la columna del proveedor y un archivo por grupo.',
      } },
      { note: 'Los cambios que hagas en una configuración son **solo para tu cuenta**. Nunca afectan a otras personas.', tone: 'info' },
    ],
  },
  {
    id: 'separaciones-reglas',
    title: 'Separaciones: cómo se separa, filtros y envío',
    blocks: [
      { h: 'Formas de separar' },
      { table: { head: ['Opción', 'Qué hace', 'Ejemplo'], rows: [
        ['Por columna', 'Un grupo por cada valor distinto de la columna elegida.', 'Un archivo por PROVEEDOR.'],
        ['Por cantidad de filas', 'Grupos de N filas en el orden del archivo.', 'Un archivo cada 1.000 filas.'],
        ['Sin separar', 'Un solo archivo con todas las filas que pasen los filtros.', 'Quitar columnas y filtrar un reporte.'],
      ] } },
      { h: 'Qué se genera' },
      { table: { head: ['Opción', 'Resultado'], rows: [
        ['Un archivo por grupo', 'Un Excel por grupo, todos dentro de un ZIP. Es la única que permite enviar correos.'],
        ['Un archivo, una hoja por grupo', 'Un solo Excel con una pestaña por grupo. Excel limita los nombres de pestaña a 31 caracteres: los nombres más largos se recortan.'],
        ['Un solo archivo con todo', 'Un Excel sin separar en grupos, con los filtros y las hojas elegidas.'],
      ] } },
      { h: 'Filtros' },
      { p: 'Los filtros funcionan igual que en el Separador express: **Incluir solo filas donde...** deja únicamente las filas que cumplan la condición; **Excluir filas donde...** quita las que la cumplan. Si hay varios, una fila tiene que cumplir todos los "incluir" y ninguno de los "excluir".' },
      { shot: 'express-filtros', caption: 'Filtros (mismo funcionamiento que en el Separador express)', legend: {
        1: 'Agregar filtro.', 2: 'Incluir o excluir.', 3: 'Columna.', 4: 'Condición.', 5: 'Valor.', 6: 'Quitar filtro.',
      } },
      { h: 'Enviar correos con una configuración propia' },
      { p: 'Si activas **Usar para enviar correos**, cada grupo se trata como un proveedor de tu lista. La configuración aparece con su propia pestaña en **Proveedores** (para elegir quién la recibe y con qué copia) y en **Copias (CC)** (para su copia por defecto), igual que PACOM.' },
    ],
  },
  {
    id: 'separaciones-hojas',
    title: 'Separaciones: hojas de cada archivo',
    blocks: [
      { p: 'Cada archivo generado puede tener varias pestañas. Hay dos clases: **hojas con datos**, que toman filas del Excel, y **hojas formulario**, que salen en blanco para que el proveedor las llene.' },
      { h: 'Columnas de una hoja con datos' },
      { shot: 'separaciones-columnas', caption: 'Elegir, ordenar y renombrar columnas', legend: {
        1: '**Todas las que traiga el archivo** (recomendado): la hoja sale con todas las columnas del Excel en su mismo orden; si el reporte agrega una columna nueva, aparece sola. **Elegir columnas**: tú decides cuáles van, en qué orden y con qué nombre.',
        2: 'Sube o baja la columna para cambiar su orden.',
        3: 'La columna del Excel de donde salen los datos.',
        4: 'El nombre con que sale en el archivo. Vacío = el mismo nombre.',
        5: 'Quita la columna.',
      } },
      { shot: 'separaciones-columnas-2', caption: 'Renombrar y agregar columnas', legend: {
        1: 'Ejemplo: la columna "Descuento minimo" sale con el nombre "% DESCUENTO MINIMO".',
        2: 'Agrega una columna del Excel de ejemplo, o una escrita a mano.',
      } },
      { h: 'Fila del encabezado y fila de total' },
      { list: [
        '**Fila del encabezado**: la app la encuentra sola. Solo escríbela si el reporte tiene un encabezado difícil de reconocer (por ejemplo, varias filas de títulos arriba).',
        '**Fila de total arriba del encabezado**: escribe o elige una columna y en cada archivo se agrega, arriba del encabezado, la suma de esa columna (como el total de VR INVENTARIO en Descuentos). Sale con el mismo formato de la columna.',
      ] },
      { note: 'Si eliges columnas a mano y un día el reporte cambia el nombre de una de ellas, la app **no genera los archivos** y te dice qué columna falta y cuáles trae el archivo. Así nunca sale una columna en blanco sin que te des cuenta.', tone: 'warn', title: 'Protección contra columnas perdidas' },
      { h: 'Hojas formulario' },
      { shot: 'separaciones-formulario', caption: 'Hoja formulario (ejemplo: CONFIRMACION DESCUENTO de Descuentos)', legend: {
        1: 'Las hojas formulario están marcadas en amarillo.',
        2: 'Notas opcionales que salen arriba, una por línea (por ejemplo, instrucciones para el proveedor).',
        3: 'Los encabezados del formulario: texto, color de fondo y ancho de columna. Las flechas cambian el orden.',
        4: 'Haz clic en el color para elegir otro.',
        5: 'Agrega otro encabezado.',
      } },
      { p: 'Debajo de los encabezados puedes indicar cuántas filas en blanco van antes del encabezado y cuántas filas vacías con borde quedan para llenar.' },
    ],
  },
  {
    id: 'separaciones-versiones',
    title: 'Separaciones: probar, guardar y versiones',
    blocks: [
      { shot: 'separaciones-vista-previa', caption: 'Así quedaría con el ejemplo', legend: {
        1: 'Con el Excel de ejemplo cargado, la app muestra cuántos archivos, grupos y filas saldrían, y avisa si falta alguna hoja o columna.',
        2: 'Descarga el archivo del primer grupo para revisarlo en Excel antes de guardar.',
      } },
      { shot: 'separaciones-historial', caption: 'Guardar y historial de versiones', legend: {
        1: 'Nota opcional para recordar qué cambiaste.',
        2: '**Guardar nueva versión**: guarda los cambios como una versión nueva. Las anteriores nunca se borran.',
        3: '**Usos**: cuántas veces se usó cada versión. Cada descarga o envío desde Procesar archivo cuenta un uso. Arriba a la derecha está el total.',
        4: 'La versión que se está usando ahora.',
        5: '**Restaurar**: vuelve a una versión anterior. Se crea una versión nueva igual a esa, así la actual también queda en el historial.',
      } },
      { list: [
        'En las de fábrica, la versión 1 es siempre la original. **Restablecer original** (arriba) hace lo mismo que restaurarla.',
        'Si cambias de configuración con cambios sin guardar, la app te pregunta antes de descartarlos.',
        'El historial de una configuración de fábrica empieza la primera vez que la editas o la usas.',
      ] },
    ],
  },
  {
    id: 'proveedores',
    title: 'Proveedores',
    blocks: [
      { p: 'Es tu lista de proveedores con sus correos. La app la usa para saber a quién enviar cada archivo.' },
      { shot: 'proveedores-todos', caption: 'Agregar proveedores', legend: {
        1: 'Pestañas: **Todos** para administrar la lista, y una pestaña por cada tipo de archivo que envía correos para elegir quién lo recibe.',
        2: 'Agrega un proveedor: nombre (igual al del Excel; no importan mayúsculas ni espacios de más), correos separados por ; y si está **Activo**. Los inactivos nunca reciben correo.',
        3: 'Descarga una plantilla de Excel para la carga masiva.',
        4: 'Sube el Excel con columnas NOMBRE DEL PROVEEDOR y CORREO(S). Los nombres que ya existen se actualizan y los nuevos se agregan.',
      } },
      { shot: 'proveedores-lista', caption: 'Lista de proveedores', legend: {
        1: 'Busca por nombre.',
        2: '**Eliminar todos**: borra toda la lista. Pide escribir una frase de confirmación.',
        3: 'Cada proveedor con sus correos y su estado.',
        4: 'Un proveedor inactivo no recibe correos aunque tenga dirección.',
        5: '**Editar** carga los datos arriba para cambiarlos; **Eliminar** lo borra (pide confirmación).',
      } },
      { h: 'Quién recibe cada tipo de archivo' },
      { shot: 'proveedores-tipo', caption: 'Pestaña de un tipo de archivo', legend: {
        1: 'La pestaña del tipo (aquí Descuentos). El número indica cuántos lo reciben.',
        2: 'Incluye o excluye a todos los proveedores visibles (si buscaste, solo a los del resultado).',
        3: 'Asigna una misma copia (CC) a todos los visibles.',
        4: 'La copia (CC) de un proveedor para este tipo. "Por defecto" usa la copia del tipo configurada en Copias (CC).',
        5: 'El interruptor: en verde recibe este tipo de archivo; apagado aparece en "No participan" al procesar.',
      } },
    ],
  },
  {
    id: 'cc',
    title: 'Copias (CC)',
    blocks: [
      { p: 'Aquí defines grupos de correos que van en copia. Cada correo enviado lleva la copia según este orden:' },
      { steps: [
        'La copia propia del proveedor para ese tipo (si se la asignaste en Proveedores).',
        'Si no tiene, la copia por defecto del tipo de archivo.',
        'Si el tipo no tiene, la configuración **General**.',
      ] },
      { shot: 'cc', caption: 'Configuraciones de copia', legend: {
        1: 'Tus configuraciones. La marcada como **base** (General) se usa cuando no hay otra asignada y no se puede eliminar.',
        2: 'Crea una configuración nueva.',
        3: 'Nombre y correos en copia (separados por ;).',
        4: 'Guarda los cambios. No se permiten dos configuraciones con exactamente los mismos correos.',
        5: 'La copia por defecto de cada tipo de archivo que envía correos.',
      } },
      { note: 'Si eliminas una configuración que algunos proveedores usan como excepción, la app te avisa cuántos son; esos proveedores vuelven a su copia por defecto.', tone: 'info' },
    ],
  },
  {
    id: 'plantilla',
    title: 'Plantilla del correo',
    blocks: [
      { p: 'Las plantillas definen el asunto y el texto de los correos. Puedes tener varias y elegir cuál usar en cada envío.' },
      { shot: 'plantilla', caption: 'Editar una plantilla', legend: {
        1: 'Tus plantillas. Pasa el mouse sobre una para ver su contenido.',
        2: 'Crea una plantilla nueva.',
        3: '**Duplicar** crea una copia para partir de ella; **Eliminar** la borra (debe quedar al menos una).',
        4: 'El asunto del correo.',
        5: 'Barra de formato del cuerpo: negrita, cursiva, subrayado, viñetas, tamaño y color de letra, insertar imagen y quitar formato.',
      } },
      { shot: 'plantilla-2', caption: 'Cuerpo y variables', legend: {
        1: 'El cuerpo del correo. Puedes pegar imágenes con Ctrl+V (por ejemplo, tu firma): llegan dentro del correo, no como adjunto.',
        2: 'Variables: haz clic para insertarlas donde está el cursor (en el asunto o en el cuerpo). **{{proveedor}}** se reemplaza por el nombre de cada proveedor y **{{mes}}** por el mes actual.',
        3: 'Guarda la plantilla.',
      } },
      { shot: 'plantilla-vista-previa', caption: 'Vista previa', legend: {
        1: 'Así se verá el asunto, con las variables reemplazadas por un ejemplo.',
        2: 'Así verá el proveedor el cuerpo del correo.',
      } },
    ],
  },
  {
    id: 'configuracion',
    title: 'Configuración: perfil y contraseña',
    blocks: [
      { shot: 'configuracion-perfil', caption: 'Perfil', legend: {
        1: 'Tu foto (o tus iniciales si no tienes foto).',
        2: 'El nombre que se muestra en el panel lateral.',
        3: 'Elige una imagen como foto de perfil (máximo 4 MB).',
        4: 'Guarda el nombre y la foto.',
      } },
      { shot: 'configuracion-cuenta', caption: 'Cuenta', legend: {
        1: 'Escribe la contraseña nueva dos veces (mínimo 6 caracteres).',
        2: 'Cambia la contraseña.',
        3: 'Revisa si hay una versión nueva de la app (ver la siguiente sección).',
      } },
    ],
  },
  {
    id: 'actualizaciones',
    title: 'Actualizaciones de la app',
    blocks: [
      { p: 'La app revisa sola, al abrirla, si hay una versión nueva. No descarga nada sin que tú lo pidas.' },
      { shot: 'actualizacion-aviso', caption: 'Aviso de versión nueva', legend: {
        1: 'El aviso dice qué versión hay y cuál tienes, con un resumen de las novedades.',
        2: '**Descargar e instalar**: descarga la versión nueva dentro de la app, con barra de progreso.',
        3: '**Ahora no**: oculta el aviso hasta la próxima vez que abras la app. Puedes seguir trabajando normal.',
      } },
      { steps: [
        'Dale **Descargar e instalar** y espera a que la barra llegue al 100%. Puedes cambiar de pantalla mientras tanto.',
        'Cuando termine aparece **Cerrar y actualizar**. Dale clic.',
        'La app se cierra y en unos segundos se vuelve a abrir sola con la versión nueva. No hay que copiar ni descomprimir nada.',
      ] },
      { shot: 'actualizacion-configuracion', caption: 'Revisar a mano desde Configuración', legend: {
        1: 'La versión que tienes instalada.',
        2: 'Revisa en este momento si hay una versión nueva.',
        3: 'Si la hay, aparece este aviso...',
        4: '...con su botón **Descargar e instalar**.',
      } },
      { note: 'Si una actualización no termina de instalarse, el detalle de lo que pasó queda en el archivo separador-actualizacion.log de la carpeta temporal de Windows (escribe %TEMP% en el explorador de archivos para abrirla).', tone: 'info' },
    ],
  },
  {
    id: 'problemas',
    title: 'Solución de problemas',
    blocks: [
      { h: '"No se pudo abrir Outlook de escritorio"' },
      { p: 'Abre Outlook de escritorio, verifica que tu cuenta esté iniciada y vuelve a enviar. La versión web de Outlook no sirve para enviar desde la app.' },
      { h: 'Outlook pregunta si un programa puede enviar correos en tu nombre' },
      { p: 'Es una protección de Outlook. Acepta para que la app pueda enviar.' },
      { h: 'Fallan varios correos o salen 0 enviados' },
      { list: [
        'Revisa en el resumen el motivo de cada uno (pasa el mouse sobre el nombre).',
        'Verifica que los correos del proveedor estén bien escritos en Proveedores.',
        'Si Microsoft bloqueó temporalmente el envío, espera unos minutos y vuelve a enviar solo a los que faltaron.',
      ] },
      { h: 'Un proveedor sale en "Sin correo en la base"' },
      { p: 'Pasa el mouse sobre su nombre para ver el motivo: no está en la lista, está inactivo o no tiene correo. Corrígelo en Proveedores y vuelve a Procesar archivo: se recalcula solo.' },
      { h: '"Ninguna hoja del archivo tiene la columna..." o "El archivo no tiene la hoja..."' },
      { p: 'Probablemente elegiste el tipo de archivo equivocado: cambia el tipo arriba (no hace falta volver a subir el archivo). Si el reporte cambió de verdad el nombre de una hoja o columna, ajusta la configuración en **Separaciones**; el mensaje dice qué hojas y columnas trae el archivo.' },
      { h: '"No se pudo procesar el archivo"' },
      { p: 'El archivo no es un Excel válido o está dañado. Ábrelo en Excel, guárdalo de nuevo como .xlsx y vuelve a cargarlo.' },
      { h: 'Un nombre sale con caracteres raros (por ejemplo "POCIÃ“N")' },
      { p: 'Así viene escrito en el Excel original. La app copia los datos tal cual; corrígelo en el reporte de origen.' },
      { h: 'Las imágenes del cuerpo no se ven en el correo recibido' },
      { p: 'Pégalas en la plantilla con Ctrl+V o con el botón de insertar imagen. Algunos clientes de correo bloquean imágenes hasta que el destinatario las permite.' },
      { h: 'No carga la lista de proveedores o no puedo iniciar sesión' },
      { p: 'Revisa tu conexión a internet. Si el problema sigue, cierra la app, vuelve a abrirla e inicia sesión de nuevo.' },
      { h: 'Windows no deja abrir el programa' },
      { p: 'Si aparece "Windows protegió su PC", haz clic en **Más información** y luego en **Ejecutar de todas formas**. Pasa porque la app no está firmada digitalmente; es seguro.' },
    ],
  },
  {
    id: 'preguntas',
    title: 'Preguntas frecuentes',
    blocks: [
      { h: '¿Puedo usar la app sin enviar correos?' },
      { p: 'Sí. **Descargar** en Procesar archivo y todo el **Separador express** funcionan sin Outlook.' },
      { h: '¿Los cambios que hago los ve otra persona?' },
      { p: 'No. Proveedores, copias, plantillas y configuraciones de separación son de cada cuenta.' },
      { h: '¿Qué pasa si el reporte trae una columna nueva?' },
      { p: 'Si la hoja está en **Todas las que traiga el archivo**, la columna nueva aparece sola en los archivos. Si elegiste columnas a mano, solo salen las que elegiste.' },
      { h: '¿Se pierde el formato de porcentajes, fechas o moneda?' },
      { p: 'No. Cada celda sale con el mismo formato y estilo del Excel original.' },
      { h: '¿Puedo deshacer un cambio en una configuración?' },
      { p: 'Sí, desde el historial de versiones en Separaciones: **Restaurar** vuelve a cualquier versión anterior.' },
      { h: '¿Puedo cambiar de pantalla mientras se envían los correos o se descarga una actualización?' },
      { p: 'Sí. El envío y la descarga siguen en segundo plano y su progreso se mantiene.' },
      { h: '¿Dónde está el manual en PDF?' },
      { p: 'En la carpeta de la app, junto al ejecutable: **MANUAL DE USO.pdf**.' },
    ],
  },
]
