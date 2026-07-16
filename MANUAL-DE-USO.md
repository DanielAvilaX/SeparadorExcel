# Manual de uso — Separador & Envío · Cruz Verde

Guía para **usar** la aplicación: qué hacer paso a paso, y qué hacer si algo sale mal.

---

## 1. ¿Qué hace esta aplicación?

Tomas **un solo archivo de Excel** que trae información de **muchos proveedores**, y la app:

1. Lo **separa en un archivo por cada proveedor**.
2. Te muestra **quién va a recibir correo y quién no**, para que revises antes.
3. **Envía a cada proveedor su archivo adjunto** por correo, **desde tu propio Outlook**.

Todo en una sola ventana. Reemplaza el proceso manual y la macro de Excel.

---

## 2. Antes de empezar (importante)

Para que el **envío de correos** funcione, siempre:

- ✅ Ten el **Outlook clásico de escritorio abierto y con tu sesión iniciada**.
  *(El de escritorio, no la versión web: la app le "pide" a tu Outlook que envíe.)*
- ✅ Ten **internet** (la lista de proveedores vive en la nube).

Si solo quieres **separar y descargar el ZIP**, no necesitas Outlook.

---

## 3. Abrir la aplicación

1. Descomprime el ZIP que te pasaron (clic derecho → **Extraer todo**).
   > ⚠️ Primero **extrae**. No ejecutes el programa desde adentro del ZIP: no funciona.
2. Entra a la carpeta y haz doble clic en **`Separador Cruz Verde.exe`**.
3. **La primera vez** Windows puede mostrar *"Windows protegió su PC"*:
   haz clic en **Más información → Ejecutar de todos modos**. Es normal (es un programa interno).
4. **Inicia sesión** con tu correo y contraseña de la app.

> 💡 **Consejo:** deja la carpeta en un lugar fijo (ej. Documentos) y crea un acceso directo al `.exe`
> (clic derecho → *Mostrar más opciones → Enviar a → Escritorio*). No hay que instalar nada.

---

## 4. Configuración inicial (una sola vez)

Antes del primer envío real, deja lista la información de estas 3 pestañas.

### 4.1 Pestaña **Proveedores**

Aquí vive la lista de a quién se le envía cada archivo. **Es la parte más importante.**

> 🔑 **Regla de oro:** el nombre del proveedor debe escribirse **EXACTAMENTE igual** a como aparece
> en el Excel. Si el Excel dice `BEIERSDORF SA`, en la app debe decir `BEIERSDORF SA` — ni
> `Beiersdorf S.A.`, ni con espacios de más. Si no coincide, **ese proveedor no recibe correo**.

**Agregar uno a uno**
1. Escribe el **Nombre** y el **Correo**.
2. Si tiene **varios correos**, sepáralos con punto y coma: `compras@x.com; ventas@x.com`
3. Deja marcado **Activo** y presiona **Agregar**.

**Cargar muchos de una vez (recomendado)**
1. Presiona **Descargar plantilla** → baja un Excel de ejemplo.
2. Llénalo con dos columnas: **NOMBRE DEL PROVEEDOR** y **CORREO(S)**
   (varios correos en la misma celda separados por `;`).
3. Presiona **Subir Excel de proveedores**.
   - Los nombres que **ya existían se actualizan**.
   - Los **nuevos se agregan**.
   - **Nada se borra.**

**Editar / Eliminar:** botones en cada fila. Al **Editar**, los datos suben al formulario de arriba.

**Eliminar todos:** borra la lista completa. Por seguridad te pide **escribir a mano** la frase
`si quiero eliminar todos los proveedores` (**no permite copiar y pegar**).
Úsalo solo si vas a recargar la lista desde cero.

### 4.2 Pestaña **Copia (CC)**

Los correos que van **en copia en todos los envíos** (por ejemplo tu jefe o el buzón del área).
Es una lista global: aplica a todos los proveedores.

### 4.3 Pestaña **Plantilla**

El **asunto** y el **cuerpo** del correo que reciben los proveedores.

#### Puedes tener varias plantillas

Puedes guardar **tantas plantillas como necesites** (por ejemplo: una para PACOM, otra para
Rotación, otra para Descuentos) y **elegir cuál usar al momento de enviar**.

- Arriba verás **Mis plantillas**: haz clic en una para editarla.
- **+ Nueva plantilla** → crea una en blanco.
- **Duplicar** → hace una copia de la actual (útil para partir de una que ya tienes).
- **Eliminar** → borra la actual (siempre debe quedar al menos una).
- Ponle un **Nombre** claro a cada una (ej. `PACOM mensual`), porque ese nombre es el que verás
  al escoger cuál enviar.

> ⚠️ Si editas una plantilla y no la guardas, verás la marca **"sin guardar"**. Si intentas
> cambiar a otra plantilla, la app te avisa antes de perder los cambios.

#### Variables

Se reemplazan solas en cada correo:

| Variable | Se reemplaza por |
|---|---|
| `{{proveedor}}` | El nombre del proveedor |
| `{{mes}}` | El mes actual |

Puedes escribirlas a mano o usar los botones `{{proveedor}}` / `{{mes}}` que están debajo del cuerpo.

> 💡 **Los botones insertan la variable donde estés escribiendo.** Si acabas de hacer clic en el
> **Asunto**, la inserta en el asunto; si estabas en el **Cuerpo**, la inserta en el cuerpo.
> El texto encima de los botones te dice dónde va a caer ("Insertar variable en **el asunto**…").

**Ejemplo**
- Asunto: `Archivos de {{mes}} — {{proveedor}}`
- Cuerpo: `Buen día, adjunto el archivo correspondiente a {{mes}}. Quedo atenta. Gracias.`

#### Dar formato al texto

Arriba del cuerpo hay una **barra de herramientas**. Selecciona el texto y aplica:

| Botón | Qué hace |
|---|---|
| **B** | Negrita |
| **I** | Cursiva |
| **U** | Subrayado |
| Lista | Viñetas |
| Tamaño | Tamaño de la letra (8 a 36 pt) |
| Color (A con barra) | Color de la letra |
| Imagen | Insertar una imagen |
| Borrador | Quitar el formato del texto seleccionado |

**Para cambiar el color:** selecciona el texto → clic en el botón de color → escoge un color
(de los rápidos o del selector) → presiona **Cambiar**. El color **solo se aplica al presionar
"Cambiar"**, así puedes probar sin miedo.

Así puedes dejar el correo como lo mandas hoy: títulos en **negrita**, palabras clave en **verde**
(fechas, el mes), viñetas para los listados, etc.

#### Imágenes en el cuerpo

El cuerpo **acepta imágenes junto con el texto**. Tres formas de agregarlas:

1. **Pegar** con `Ctrl + V` (un recorte de pantalla o una imagen copiada).
2. **Arrastrar** el archivo de imagen dentro del cuadro.
3. Botón de **imagen** en la barra, para buscarla en tu computador.

Se envían **tal cual las ves**, incrustadas dentro del correo (no como archivos adjuntos sueltos).

- Para **borrar** una imagen: haz clic sobre ella y presiona `Suprimir`.
- Las imágenes muy grandes **se reducen automáticamente** para que el correo no pese de más.
- El **texto** se pega **sin formato** (limpio), para evitar que se dañe el diseño al copiar de Word
  u Outlook. Dale el formato con la barra de herramientas.

> ℹ️ Todo (texto, formato e imágenes) queda guardado **dentro de la plantilla**: se usa igual en
> todos los envíos, no hay que volver a armarlo cada vez.

Abajo tienes una **Vista previa** que muestra el correo **tal como lo verá el proveedor**.
No olvides **Guardar plantilla**.

---

## 5. Uso normal: separar y enviar

### Paso 1 — Elige el tipo de archivo
Selecciona **PACOM**, **Rotación por canales** o **Descuentos**.
Cada uno lee su archivo distinto, así que **elegir bien el tipo es clave**.

### Paso 2 — Carga el archivo
Arrástralo a la zona indicada o haz clic para buscarlo.
- Mientras lo lee verás una **barra de porcentaje**.
- Al terminar aparece la **tarjeta del archivo** (nombre, tipo y peso) con botones
  **Reemplazar** / **Eliminar**.
- Abajo verás la **columna de proveedor detectada** y un **prefijo** opcional para el nombre de los
  archivos (ej. `PACOM_Agosto_`).

### Paso 3 — Revisa antes de enviar
La app cruza los proveedores del archivo contra tu lista:

| Columna | Significa |
|---|---|
| 🟢 **Recibirán correo** | Están en tu lista, activos y con correo. **A estos se les envía.** |
| 🟡 **Sin correo en la base** | No coinciden, están inactivos o no tienen correo. **A estos NO se les envía.** |

Si alguien está en amarillo y **sí** debería recibir:
1. Ve a **Proveedores** y agrégalo (con el nombre **exacto**).
2. Vuelve a **Procesar archivo**: **el archivo sigue cargado** y la lista **se recalcula sola**.
   No tienes que volver a subir nada.

> Los proveedores en amarillo **no bloquean el envío**: puedes enviar a los verdes igual.

### Paso 4 — Elige la plantilla y envía
Antes de los botones verás **Plantilla del correo**: haz clic en la que quieras usar para este envío
(la seleccionada queda marcada con **●** en verde). Se administran en la pestaña **Plantilla**.

- **Descargar ZIP** → baja una carpeta comprimida con **un Excel por proveedor** (sin enviar correos).
- **Enviar N correos** → envía a cada proveedor verde su archivo adjunto desde tu Outlook,
  usando la plantilla elegida. Te pide confirmación antes (y te recuerda cuál plantilla vas a usar).

### Paso 5 — Durante el envío
Aparece una **ventana de progreso** con:
- La **barra de avance** y el **porcentaje**.
- El conteo: **`23/150 correos`**.
- **A quién se le está enviando** en ese momento.
- Un botón **Cancelar envío**.

> 🛡️ Esa ventana **cubre toda la app a propósito**: si tocas otra pestaña o archivo por accidente,
> **el envío no se interrumpe**. Déjala trabajar.

**Los envíos son pausados a propósito.** La app espera unos segundos entre correo y correo (y hace
una pausa más larga cada 40) para que **Microsoft no bloquee tu cuenta por spam**. Es normal que un
lote grande tarde varios minutos:

| Cantidad | Tiempo aproximado |
|---|---|
| 25 correos | ~1 minuto |
| 75 correos | ~3 minutos |
| 150 correos | ~9 minutos |

**Si cancelas:** te pide confirmar y detiene el envío **después del correo en curso** (no deja
ninguno a medias). Los que ya salieron **no se pueden deshacer**.

### Paso 6 — Resumen final
Al terminar (o al cancelar) verás:
- 🟢 **Enviados** → a quiénes sí les llegó.
- 🟡 **No enviados** → a quiénes no, y por qué (o *"no alcanzado"* si cancelaste).

También puedes verificarlo en **Elementos enviados** de tu Outlook.

---

## 6. Qué genera cada tipo de archivo

| Tipo | Columna del proveedor | Qué recibe cada proveedor |
|---|---|---|
| **PACOM** | `PROVEEDOR` | 2 hojas: `CONFIRMACION DESCUENTO` + `LISTAS DE PRODUCTOS` |
| **Rotación por canales** | `NOMBRE_PROV` | 1 hoja con sus filas |
| **Descuentos** | `PROVEEDOR` | 2 hojas: `CONFIRMACION DESCUENTO` + `DEPURACION` (con el total del inventario) |

> La app **encuentra sola** la fila de los encabezados, aunque no sea la primera.

---

## 7. Si algo sale mal

### ❌ "No se pudo abrir Outlook de escritorio"
**Causa:** Outlook clásico no está abierto o sin sesión.
**Solución:** abre Outlook, espera a que cargue tu correo y vuelve a darle **Enviar**.

### ❓ Outlook pregunta "un programa quiere enviar un correo en tu nombre"
**Es normal.** Dale **Permitir**. Es la misma alerta que sale con las macros.

### ⚠️ Dice "0 correos enviados" o fallan varios
**Causa más común:** Microsoft está limitando tu cuenta por muchos envíos seguidos (anti-spam),
o Outlook perdió conexión.
**Solución:**
1. Revisa si te llegaron correos de *"No se pudo entregar"* del **Administrador del sistema**.
2. **Espera un rato** (puede ser un par de horas) antes de reintentar. **No insistas seguido:
   empeora el bloqueo.**
3. Verifica que Outlook diga abajo **"Conectado a Microsoft Exchange"**.
4. Reintenta solo con los proveedores que faltaron.

### ⚠️ Un proveedor sale en amarillo ("Sin correo en la base")
**Causa:** su nombre **no coincide exactamente**, está inactivo, o no tiene correo.
**Solución:** compara el nombre carácter por carácter, corrígelo en **Proveedores** (o en el Excel)
y vuelve a **Procesar** — se recalcula solo.

### ⚠️ "El archivo no tiene la columna PROVEEDOR / NOMBRE_PROV"
**Causa:** elegiste el **tipo equivocado**.
**Solución:** cambia el tipo arriba (PACOM / Rotación / Descuentos) y vuelve a subirlo.

### ⚠️ "No se pudo leer el archivo. ¿Es un Excel válido?"
**Solución:** confirma que sea `.xlsx` o `.xls` y que **no esté abierto en Excel** al mismo tiempo.
Ciérralo y vuelve a subirlo.

### ⚠️ Las imágenes del cuerpo no se ven en el correo que llegó
**Causa:** el proveedor tiene **bloqueada la descarga automática de imágenes** en su correo
(es una configuración de él, muy común).
**Solución:** normalmente le aparece un aviso tipo *"Haga clic aquí para descargar las imágenes"*.
No es un problema de la app: las imágenes **sí van dentro** del correo. Puedes verificarlo abriendo
el correo en tu carpeta **Elementos enviados**.

### ⚠️ La plantilla no guarda o va muy lenta
**Causa:** imágenes demasiado pesadas en el cuerpo.
**Solución:** usa imágenes más livianas (recortes en vez de fotos completas) o menos imágenes.

### ⚠️ No carga la lista de proveedores / no puedo iniciar sesión
**Causa:** sin internet o problema de conexión.
**Solución:** revisa la conexión y vuelve a abrir la app. Si sigue, avisa a Daniel.

### ⚠️ Windows no deja abrir el programa
**Solución:** *Más información → Ejecutar de todos modos*. Y verifica que hayas **extraído** el ZIP
antes de ejecutarlo.

---

## 8. Recomendaciones importantes

1. 🧪 **Antes de un envío grande, haz una prueba.** Agrega un proveedor de prueba con **tu propio
   correo**, procesa un archivo pequeño y envíate 1 correo. Verifica que llegue bien (adjunto,
   asunto y cuerpo). Recién ahí manda el lote real.
2. 👀 **Siempre revisa el Paso 3** antes de enviar: es tu última oportunidad de detectar un
   proveedor mal escrito.
3. ⏳ **No cierres la app durante un envío.**
4. 🔁 **Mantén la lista de proveedores al día:** la mayoría de los problemas vienen de nombres
   que no coinciden.
5. 🚫 **No repitas envíos seguidos** al mismo destinatario: activa el anti-spam de Microsoft.

---

## 9. Preguntas frecuentes

**¿Desde qué correo salen?**
Desde **tu propia cuenta de Outlook**. Quedan en tu carpeta *Elementos enviados*, igual que si los
hubieras escrito tú.

**¿Puedo usarla en otro computador?**
Sí: copia la carpeta y ejecútala. Tu lista de proveedores, CC y plantilla te siguen (están en la
nube). Ese computador también necesita **Outlook clásico**.

**¿Se puede deshacer un envío?**
No. Por eso están la pantalla de revisión y la confirmación.

**¿Tengo que instalar algo?**
No. El programa es portable: se extrae y se ejecuta.

**¿Qué pasa si cierro la app por accidente mientras envía?**
Se detiene el envío. Revisa *Elementos enviados* para ver hasta dónde llegó y vuelve a enviar solo
a los que faltaron.

**¿Puedo trabajar en otra cosa mientras envía?**
Sí, en otros programas. Solo no cierres la app ni Outlook.

---

## 10. ¿Necesitas ayuda?

Si el error se repite o no está aquí, contacta a **Daniel** con:
- Una **captura de pantalla** del error.
- Qué **tipo de archivo** estabas procesando.
- Cuántos proveedores tenía.
