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
    const validProviders = new Set([
      "A MENARINI LATIN AMERICA SLU SUCURSAL COLOMBIA",
      "ABBOTT LABORATORIES DE COLOMBIA SAS",
      "ABBVIE SAS",
      "ADIUM SAS",
      "AIPHEX GLOBALPHARMA SAS",
      "ALFA TRADING SAS",
      "ALTADIS FARMACEUTICA SAS",
      "AMAREY NOVA MEDICAL SA",
      "APROD PHARMA SAS",
      "AQUILABS SA",
      "ASCEND LABORATORIES SAS",
      "ASOCIACION PROFAMILIA",
      "ASPEN COLOMBIANA SAS",
      "ASTELLAS FARMA COLOMBIA SAS",
      "AXON PHARMA SAS",
      "BAYER SA",
      "BESPHARMA SAS",
      "BIIOSMART SAS",
      "BIOCHEM FARMACEUTICA DE COLOMBIA LTDA",
      "BOEHRINGER INGELHEIM SA",
      "BOIRON SAS",
      "BON SANTE SAS",
      "BSN MEDICAL LTDA",
      "CALIER FARMACEUTICA DE COLOMBIA SA",
      "CANNABISSALUD SAS",
      "CH CONSUMOS HOSPITALARIOS S A S",
      "CLINICA DE MARLY SA",
      "CLOSTER PHARMA SAS",
      "CLOSTER PHARMA",
      "COLQUIMICOS SA",
      "COLVENFAR SAS",
      "COMERCIALIZADORA RUECAM SAS",
      "COMERLAT PHARMACEUTICAL SAS",
      "COMESTIBLES ALDOR SAS",
      "COMFORT PRODUCTS COLOMBIA SAS",
      "CORPORACION FOMENTO ASISTENCIAL HOSPITAL UNIVERSITARIO SAN VICENTE DE",
      "COSMONOVA COLOMBIA SAS",
      "DERMAPLUS SAS",
      "DIABETRICS HEALTHCARE S A S",
      "DISTRIBUIDORA INTERNACIONAL MEDWELL SAS",
      "ELI LILLY INTERAMERICA INC",
      "EP CHEMICALS SAS",
      "ESPECIALIDADES OFTALMOLOGICAS SA",
      "EUROETIKA LTDA",
      "EUROFARMA COLOMBIA SAS",
      "EUROPEAN PHARMA SOLUTIONS SAS",
      "EXELTIS SAS",
      "FAES FARMA COLOMBIA SAS",
      "FARMA DE COLOMBIA SAS",
      "FARMACIA DROGUERIA SAN JORGE LTDA",
      "FARMACOL CHINOIN SAS",
      "FUNDACION LABORATORIO DE FARMOCOLOGIA VEGETAL LABFARVE",
      "GADOR SAS",
      "GALBBENI SAS",
      "GEDEON RICHTER COLOMBIA S A S",
      "GENFAR SA",
      "GENOMMA LAB COLOMBIA LTDA",
      "GENYX SAS",
      "GILEAD SCIENCES COLOMBIA SAS",
      "GLA TRADING SAS",
      "GLAXOSMITHKLINE COLOMBIA SA",
      "GLAXOSMITHKLINE CONSUMER HEALTHCARE COLOMBIA SAS",
      "GLENMARK PHARMACEUTICALS COLOMBIA SAS",
      "GMEDIOS SAS",
      "GRUNENTHAL COLOMBIANA SA",
      "GUERRERO FERRER SANDRA PATRICIA",
      "HALEON COLOMBIA SAS",
      "HEALTHY AMERICA COLOMBIA SAS",
      "HEEL COLOMBIA LTDA",
      "HUMANCARE SAS",
      "HUMAX PHARMACEUTICAL SA",
      "ILAB SAS",
      "IMEX GROUP SAS",
      "IMPHA SAS",
      "INMUNOPHARMA SAS",
      "INTERNATURALWORLD SAS",
      "INVERFARMA LTDA",
      "INVERLAR COLOMBIA SAS",
      "INVERSIONES PLAMATECH LTDA",
      "IPCA LABORATORIES LIMITED SUCURSAL COLOMBIA",
      "IPSEN COLOMBIA SAS",
      "JGB SA",
      "LABORATORIO FRANCO COLOMBIANO LAFRANCOL SAS",
      "LABORATORIO INTERNACIONAL DE COLOMBIA SA LABINCO SA",
      "LABORATORIO PROFESIONAL FARMACEUTICO SA",
      "LABORATORIO SAN JORGE SAS BIC",
      "LABORATORIOS ALCON DE COLOMBIA SA",
      "LABORATORIOS ARMOFAR LTDA",
      "LABORATORIOS BAGO DE COLOMBIA SAS",
      "LABORATORIOS BEST SA",
      "LABORATORIOS BIOPAS SA",
      "LABORATORIOS BLASKOV LTDA",
      "LABORATORIOS BLOFARMA DE COLOMBIA SAS",
      "LABORATORIOS BUSSIE SA",
      "LABORATORIOS CERO SA",
      "LABORATORIOS CHALVER DE COLOMBIA SA",
      "LABORATORIOS CIENCIA Y NATURALEZA SAS",
      "LABORATORIOS DE PRODUCTOS NATURASOL MORENO GARCIA ROJAS E HIJOS & CIA S EN CS",
      "LABORATORIOS ECAR SA",
      "LABORATORIOS FINLAY DE COLOMBIA SAS",
      "LABORATORIOS FUNAT SAS",
      "LABORATORIOS GERCO SAS",
      "LABORATORIOS HEALPHARMA DE COLOMBIA SAS",
      "LABORATORIOS INCOBRA SA",
      "LABORATORIOS LA SANTE SA",
      "LABORATORIOS LEGRAND SA",
      "LABORATORIOS LEGRAND SA",
      "LABORATORIOS MEDICK SAS",
      "LABORATORIOS MEREY SAS",
      "LABORATORIOS MINERALIN S A S",
      "LABORATORIOS MINTLAB SAS",
      "LABORATORIOS NATUFAR S A S",
      "LABORATORIOS NATURAL FRESHLY INFABO INST FARCOLGCO BOTANICO",
      "LABORATORIOS NATURCOL S.A.",
      "LABORATORIOS NATURFAR SAS",
      "LABORATORIOS REMO SAS",
      "LABORATORIOS RICHMOND COLOMBIA SAS",
      "LABORATORIOS SERVIER DE COLOMBIA SAS",
      "LABORATORIOS SIEGFRIED SAS",
      "LABORATORIOS SOPHIA DE COLOMBIA LTDA",
      "LABQUIFAR LTDA",
      "MEDIMFARMA SAS",
      "MEGALABS COLOMBIA SAS",
      "MERCK SA",
      "MERCK SHARP & DOHME COLOMBIA SAS",
      "MUNDIPHARMA COLOMBIA SAS",
      "N.T.I NEW TRADE INTERNATIONAL",
      "NEILMED LATAM COLOMBIA SAS",
      "NEVOX FARMA SA",
      "NEWFOUNDLAND DIAGNOSTICS SAS",
      "NEXT PHARMA SOURCING SAS",
      "NOVAMED SA",
      "NOVARTIS DE COLOMBIA SA",
      "NOVO NORDISK COLOMBIA S A S",
      "NTI NEW TRADE INTERNATIONAL",
      "NUTRABIOTICS SAS",
      "OFTALMOQUIMICA LTDA",
      "OPELLA HEALTHCARE COLOMBIA SAS",
      "ORGANON COLOMBIA SAS",
      "ORTIX S A S",
      "PFIZER SAS",
      "PHARMA CID SAS",
      "PHARMALAB PHL LABORATORIOS SAS",
      "PHARMAPRIX COLOMBIA SAS",
      "PHARMARIS COLOMBIA SAS",
      "PHYTOPHARMA FOODS SAS",
      "PISA FARMACEUTICA DE COLOMBIA SA",
      "PROCAPS SA",
      "PROCTER  GAMBLE COLOMBIA LTDA",
      "PRODUCTOS DISANFER SAS",
      "PRODUCTOS ROCHE SA",
      "QUIBI SA EN REESTRUCTURACION",
      "RB HEALTH COLOMBIA SAS",
      "REGENECARE SAS",
      "SABOGAL FONCESA DAVID ANDRES",
      "SABOGAL FONSECA DAVID ANDRES",
      "SALUS PHARMA LABS SAS",
      "SANOFI AVENTIS DE COLOMBIA SA",
      "SC JOHNSON  SON COLOMBIANA SA",
      "SENSOBIO SAS",
      "SEVEN PHARMA COLOMBIA S A S",
      "SUIPHAR DE COLOMBIA S A S",
      "SUPERFUDS SAS",
      "SYGMA LABORATORIES SAS",
      "TECNIGEN COLOMBIA,MEDICINA,CIENCIA Y TECNOLOGÍA SAS",
      "TECNOQUIMICAS SA",
      "UNIQUE INTERNATIONAL SAS",
      "UNITED PHARMACEUTICALS SAS",
      "VISION ESTRATEGICA EFECTIVA SAS",
      "VITALIS SA CI",
      "VITALISTA SAS",
      "VIVUNT PHARMA COLOMBIA SAS",
      "ZAMBON COLOMBIA SA"
    ]);

    // Verificar si la columna "Proveedor" existe en los datos
    const providerColumn = "PROVEEDOR"; // Asegúrate de que este es el nombre correcto de la columna en el Excel

    // Filtrar datos por proveedores válidos antes de agruparlos
    const filteredData = jsonData.filter(row => validProviders.has(row[providerColumn]));

    // Usar los datos filtrados en la agrupación
    const groupedData = filteredData.reduce((acc, row) => {
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
                const fixedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
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
      XLSX.utils.book_append_sheet(newWorkbook, worksheet, 'Participación');
      const excelBuffer = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'array' });

      zip.file(`${filePrefix}${key}.xlsx`, excelBuffer);
    });

    zip.generateAsync({ type: 'blob' }).then(content => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'DOCUMENTOS_SEPARADOS.zip';
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
