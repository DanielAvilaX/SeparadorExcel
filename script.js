let columns = [];

document.getElementById('fileInput').addEventListener('change', handleFile);

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    columns = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];

    if (!columns) {
      alert('No se encontraron columnas en el archivo');
      return;
    }

    renderColumns();
  };

  reader.readAsArrayBuffer(file);
}

function renderColumns() {
  const container = document.getElementById('columnsContainer');
  container.innerHTML = '';
  columns.forEach(col => {
    const label = document.createElement('label');
    label.innerHTML = `
      <input type="checkbox" value="${col}" checked> 
      <span>${col}</span>
      <input type="radio" name="referenceColumn" value="${col}">
      (Columna para el nombre)
    `;
    container.appendChild(label);
  });
}

function toggleSelectAll() {
  const checkboxes = document.querySelectorAll('#columnsContainer input[type="checkbox"]');
  const allChecked = [...checkboxes].every(cb => cb.checked);
  checkboxes.forEach(cb => cb.checked = !allChecked);
}

function generateFiles() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files.length) {
      alert('Por favor sube un archivo primero');
      return;
    }
  
    const referenceColumn = document.querySelector('input[name="referenceColumn"]:checked');
    if (!referenceColumn) {
      alert('Por favor selecciona una columna para nombrar los archivos.');
      return;
    }
  
    const reader = new FileReader();
    reader.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false });
  
      const selectedColumns = [...document.querySelectorAll('#columnsContainer input[type="checkbox"]:checked')]
        .map(cb => cb.value);
  
      const filePrefix = document.getElementById('filePrefix').value.trim();
  
      const groupedData = jsonData.reduce((acc, row) => {
        const key = row[referenceColumn.value];
        if (!key) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key].push(selectedColumns.reduce((obj, col) => {
          if (row[col] !== undefined) obj[col] = row[col];
          return obj;
        }, {}));
        return acc;
      }, {});
  
      const zip = new JSZip();
  
      Object.keys(groupedData).forEach(key => {
        const worksheet = XLSX.utils.json_to_sheet(groupedData[key]);
  
        const range = XLSX.utils.decode_range(worksheet['!ref']);
  
        // Estilo para encabezados (verde + negrita)
        const headerStyle = {
          fill: { fgColor: { rgb: "00FF00" } },
          font: { bold: true },
          alignment: { horizontal: 'center' }
        };
  
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: C })];
          if (cell) cell.s = headerStyle;
        }
  
        // Ajuste de formato para fechas, descripciones y porcentajes
        for (let R = range.s.r + 1; R <= range.e.r; ++R) { // Ignoramos la fila de encabezados
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            const header = worksheet[XLSX.utils.encode_cell({ r: 0, c: C })]?.v;
            const cell = worksheet[cellRef];
  
            if (cell && header) {
              // Formatear columnas de fecha
              if (header.toLowerCase().includes('fecha')) {
                if (typeof cell.v === 'number') { // Excel usa números seriales para fechas
                  const date = XLSX.SSF.parse_date_code(cell.v);
                  if (date) {
                    const formattedDate = new Date(Date.UTC(date.y, date.m - 1, date.d));
                    // Ajuste del desfase horario para evitar cambio de día
                    const fixedDate = new Date(formattedDate.getUTCFullYear(), formattedDate.getUTCMonth(), formattedDate.getUTCDate());
                    cell.t = 'd';
                    cell.v = fixedDate;
                    cell.z = 'dd/mm/yyyy';
                  }
                } else if (typeof cell.v === 'string' && isValidDate(cell.v)) {
                  const date = new Date(cell.v);
                  const fixedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()+1);
                  cell.t = 'd';
                  cell.v = fixedDate;
                  cell.z = 'dd/mm/yyyy';
                }
              }
  
              // Evitar que descripciones sean interpretadas como fecha
              if (header.toLowerCase().includes('descripcion') && typeof cell.v === 'number') {
                cell.t = 's'; // Forzar texto
              }
  
              // Formatear columnas de descuento
              if (header.toLowerCase().includes('descuento')) {
                if (typeof cell.v === 'number') {
                  cell.v = cell.v * 100; // Ajustar valor
                  cell.t = 'n';
                  cell.z = '0%'; // Sin decimales
                }
              }
            }
          }
        }
  
        // Añadir bordes y ajustar ancho dinámico
        const colWidths = columns.map(col => ({ wch: Math.max(...groupedData[key].map(row => (row[col] || '').toString().length), col.length) + 2 }));
        worksheet['!cols'] = colWidths;
  
        const borderStyle = {
          top: { style: "thin" },
          right: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" }
        };
  
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
            if (cell) cell.s = { ...cell.s, border: borderStyle };
          }
        }
  
        const newWorkbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWorkbook, worksheet, 'Datos');
        const excelBuffer = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'array' });
  
        zip.file(`${filePrefix}${key}.xlsx`, excelBuffer);
      });
  
      zip.generateAsync({ type: 'blob' }).then(content => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'archivos_separados.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    };
  
    reader.readAsArrayBuffer(fileInput.files[0]);
  }
  
  // Función para validar fechas en formato string
  function isValidDate(dateString) {
    const date = Date.parse(dateString);
    return !isNaN(date);
  }
  