const fileInput = document.querySelector("#excelFile");
const processButton = document.querySelector("#processButton");
const fileSummary = document.querySelector("#fileSummary");
const statusMessage = document.querySelector("#statusMessage");

const supportedExtensions = ["csv"];

const CNPJ_VALUE = "34446018000133";
const COLUMN_CNPJ = 1;
const COLUMN_DESTCPFCNPJ = 15;
const COLUMN_DEST_TELEFONE1 = 28;
const DEST_TELEFONE1_NULL_REPLACEMENT = "111111111";
const COLUMN_DEST_END = 17;
const COLUMN_DEST_END_NUM = 18;
const COLUMN_DEST_COMPL = 19;
const COLUMN_DESTNOME = 14;
const COLUMN_DEST_EMAIL = 26;
const DEST_EMAIL_NAO_INFORMADO_REPLACEMENT = "naoinformado";
const COLUMN_DEST_CEP = 25;
const COLUMN_AG_DATA = 35;
const COLUMN_NFE_DATA = 41;
const EMPTY_COLUMN_REPLACEMENT = "1";

let selectedFile = null;
let processedBlobUrl = null;
let processedFileName = "arquivo_passo6.csv";

const dragOverlay = document.querySelector("#dragOverlay");
const loadingOverlay = document.querySelector("#loadingOverlay");
let dragCounter = 0;

document.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragCounter++;
  dragOverlay.classList.add("active");
});

document.addEventListener("dragleave", () => {
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dragOverlay.classList.remove("active");
  }
});

document.addEventListener("dragover", (e) => {
  e.preventDefault();
});

document.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  dragOverlay.classList.remove("active");

  const file = e.dataTransfer?.files?.[0];
  if (!file) return;

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!supportedExtensions.includes(extension)) {
    statusMessage.textContent = "Formato invalido. Envie um arquivo .csv.";
    return;
  }

  selectedFile = file;
  processedFileName = buildProcessedName(file.name);
  clearProcessedBlob();
  fileSummary.innerHTML = `
    <p class="summary-label">Arquivo pronto para iniciar</p>
    <p class="summary-value"><strong>${file.name}</strong><br>Tamanho: ${formatBytes(file.size)}</p>
  `;
  statusMessage.textContent = "Arquivo CSV validado. Pronto para processar.";
  processButton.disabled = false;
});

fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;

  if (!file) {
    selectedFile = null;
    resetState();
    return;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  if (!supportedExtensions.includes(extension)) {
    selectedFile = null;
    resetState();
    statusMessage.textContent = "Formato invalido. Envie um arquivo .csv.";
    return;
  }

  selectedFile = file;
  processedFileName = buildProcessedName(file.name);
  clearProcessedBlob();
  fileSummary.innerHTML = `
    <p class="summary-label">Arquivo pronto para iniciar</p>
    <p class="summary-value"><strong>${file.name}</strong><br>Tamanho: ${formatBytes(file.size)}</p>
  `;

  statusMessage.textContent = "Arquivo CSV validado. Pronto para processar.";
  processButton.disabled = false;
});

processButton.addEventListener("click", async () => {
  if (!selectedFile) {
    statusMessage.textContent = "Selecione um arquivo CSV antes de continuar.";
    return;
  }

  processButton.disabled = true;
  statusMessage.textContent = "Processando arquivo...";
  loadingOverlay.classList.add("active");
  await new Promise((r) => setTimeout(r, 0));

  try {
    const rawText = await readCsvText(selectedFile);
    const delimiter = detectDelimiter(rawText);
    const parsedRows = parseCsv(rawText, delimiter);

    if (parsedRows.length === 0) {
      throw new Error("O arquivo CSV esta vazio.");
    }

    const withoutQuotes = removeSingleQuotesFromRows(parsedRows);
    const withCnpj = fillCnpjColumn(withoutQuotes);
    const withTelefone1 = fillTelefone1NullValues(withCnpj);
    const withAddress = fillEmptyAddressColumns(withTelefone1);
    const withEmail = normalizeDestEmail(withAddress);
    const withCep = normalizeCepColumn(withEmail);
    const withSorted = sortByDestNome(withCep);
    const withDates = convertDatesToBrFormat(withSorted);
    const processedRows = applyExcelNumericFormatting(withDates);
    const csvOutput = buildCsv(processedRows, delimiter);
    const dateValue = processedRows.length > 1 ? String(processedRows[1][COLUMN_NFE_DATA] ?? "").trim() : "";
    processedFileName = dateValue ? `CSV_TOTAL_${formatDateDDMMYYYY(dateValue)}.csv` : "CSV_TOTAL.csv";

    clearProcessedBlob();
    const encoded = encodeWindows1252(csvOutput);
    const blob = new Blob([encoded], { type: "text/csv;charset=windows-1252;" });
    processedBlobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = processedBlobUrl;
    link.download = processedFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    statusMessage.textContent = "Arquivo tratado e ordenado em ordem alfabética. Download iniciado.";
  } catch (error) {
    statusMessage.textContent = `Falha no processamento: ${error.message}`;
  } finally {
    loadingOverlay.classList.remove("active");
    processButton.disabled = false;
  }
});



function resetState() {
  clearProcessedBlob();
  fileSummary.innerHTML = `
    <p class="summary-label">Nenhum arquivo selecionado</p>
  `;
  processButton.disabled = true;
}

resetState();

function formatDateDDMMYYYY(value) {
  // ISO: 2026-05-08 → 08_05_2026
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[3]}_${isoMatch[2]}_${isoMatch[1]}`;
  // BR slash: 08/05/2026 → 08_05_2026
  return value.replace(/\//g, "_");
}

function convertDatesToBrFormat(rows) {
  if (rows.length === 0) return rows;
  const header = rows[0];
  const dataRows = rows.slice(1).map((row) => {
    const next = [...row];
    for (const col of [COLUMN_AG_DATA, COLUMN_NFE_DATA]) {
      if (next.length > col) {
        const val = String(next[col]).trim();
        const isoMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (isoMatch) next[col] = `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
      }
    }
    return next;
  });
  return [header, ...dataRows];
}

function applyExcelNumericFormatting(rows) {
  if (rows.length === 0) return rows;
  const header = rows[0];
  const dataRows = rows.slice(1).map((row) => {
    const next = [...row];
    for (const col of [COLUMN_DESTCPFCNPJ, COLUMN_DEST_CEP]) {
      while (next.length <= col) next.push("");
      const val = String(next[col]).trim();
      const stripped = val.replace(/^0+/, "") || val;
      next[col] = stripped + "    ";
    }
    while (next.length <= COLUMN_DEST_TELEFONE1) next.push("");
    next[COLUMN_DEST_TELEFONE1] = String(next[COLUMN_DEST_TELEFONE1]) + "    ";
    return next;
  });
  return [header, ...dataRows];
}

function normalizeCepColumn(rows) {
  if (rows.length === 0) return rows;
  const header = rows[0];
  const dataRows = rows.slice(1).map((row) => {
    const next = [...row];
    while (next.length <= COLUMN_DEST_CEP) next.push("");
    const onlyDigits = String(next[COLUMN_DEST_CEP]).replace(/\D/g, "");
    next[COLUMN_DEST_CEP] = onlyDigits === "" ? "0" : onlyDigits;
    return next;
  });
  return [header, ...dataRows];
}

function normalizeDestEmail(rows) {
  if (rows.length === 0) return rows;
  const header = rows[0];
  const dataRows = rows.slice(1).map((row) => {
    const next = [...row];
    while (next.length <= COLUMN_DEST_EMAIL) next.push("");
    const normalized = String(next[COLUMN_DEST_EMAIL])
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (normalized === "nao informado") {
      next[COLUMN_DEST_EMAIL] = DEST_EMAIL_NAO_INFORMADO_REPLACEMENT;
    }
    return next;
  });
  return [header, ...dataRows];
}

function sortByDestNome(rows) {
  if (rows.length === 0) return rows;
  const header = rows[0];
  const dataRows = rows.slice(1).sort((a, b) =>
    String(a[COLUMN_DESTNOME] ?? "").localeCompare(String(b[COLUMN_DESTNOME] ?? ""), "pt-BR", { sensitivity: "base" })
  );
  return [header, ...dataRows];
}

function removeSingleQuotesFromRows(rows) {
  return rows.map((row) => row.map(removeSingleQuotes));
}

function fillEmptyAddressColumns(rows) {
  if (rows.length === 0) return rows;
  const header = rows[0];
  const cols = [COLUMN_DEST_END, COLUMN_DEST_END_NUM, COLUMN_DEST_COMPL];
  const dataRows = rows.slice(1).map((row) => {
    const next = [...row];
    for (const col of cols) {
      while (next.length <= col) next.push("");
      if (String(next[col]).trim() === "" || String(next[col]).trim().toLowerCase() === "null") {
        next[col] = EMPTY_COLUMN_REPLACEMENT;
      }
    }
    if (next[COLUMN_DEST_COMPL].length > 99) {
      next[COLUMN_DEST_COMPL] = next[COLUMN_DEST_COMPL].slice(0, 99);
    }
    return next;
  });
  return [header, ...dataRows];
}

function fillTelefone1NullValues(rows) {
  if (rows.length === 0) return rows;
  const header = rows[0];
  const dataRows = rows.slice(1).map((row) => {
    const next = [...row];
    while (next.length <= COLUMN_DEST_TELEFONE1) next.push("");
    if (String(next[COLUMN_DEST_TELEFONE1]).trim().toLowerCase() === "null") {
      next[COLUMN_DEST_TELEFONE1] = DEST_TELEFONE1_NULL_REPLACEMENT;
    }
    return next;
  });
  return [header, ...dataRows];
}

function fillCnpjColumn(rows) {
  if (rows.length === 0) return rows;
  const header = rows[0];
  const dataRows = rows.slice(1).map((row) => {
    const next = [...row];
    while (next.length <= COLUMN_CNPJ) next.push("");
    next[COLUMN_CNPJ] = CNPJ_VALUE;
    return next;
  });
  return [header, ...dataRows];
}

function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
    rows.pop();
  }

  return rows;
}

async function readCsvText(file) {
  const buffer = await file.arrayBuffer();
  return decodeCsvBuffer(buffer);
}

function decodeCsvBuffer(buffer) {
  const utf8Text = decodeWithEncoding(buffer, "utf-8", false);

  if (utf8Text !== null && !utf8Text.includes("\uFFFD")) {
    return utf8Text;
  }

  const windows1252Text = decodeWithEncoding(buffer, "windows-1252", false);
  if (windows1252Text !== null) {
    return windows1252Text;
  }

  const latin1Text = decodeWithEncoding(buffer, "iso-8859-1", false);
  if (latin1Text !== null) {
    return latin1Text;
  }

  throw new Error("Nao foi possivel decodificar o arquivo CSV.");
}

function decodeWithEncoding(buffer, encoding, fatal) {
  try {
    return new TextDecoder(encoding, { fatal }).decode(buffer);
  } catch {
    return null;
  }
}

function detectDelimiter(text) {
  const firstLine = getFirstDataLine(text);
  const commaCount = countDelimiterOutOfQuotes(firstLine, ",");
  const semicolonCount = countDelimiterOutOfQuotes(firstLine, ";");
  return semicolonCount > commaCount ? ";" : ",";
}

function getFirstDataLine(text) {
  const normalized = text.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r\n|\n|\r/);

  for (const line of lines) {
    if (line.trim() !== "") {
      return line;
    }
  }

  return "";
}

function countDelimiterOutOfQuotes(line, delimiter) {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
}

function encodeWindows1252(str) {
  const special = new Map([
    [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
    [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
    [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
    [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
    [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c],
    [0x017e, 0x9e], [0x0178, 0x9f],
  ]);
  const bytes = [];
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code >= 0xa0 && code <= 0xff) {
      bytes.push(code);
    } else if (special.has(code)) {
      bytes.push(special.get(code));
    } else {
      bytes.push(0x3f);
    }
  }
  return new Uint8Array(bytes);
}

function buildCsv(rows, delimiter) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const normalized = String(value ?? "");
          if (normalized.includes('"') || normalized.includes("\n") || normalized.includes("\r") || normalized.includes(delimiter)) {
            return `"${normalized.replace(/"/g, '""')}"`;
          }
          return normalized;
        })
        .join(delimiter)
    )
    .join("\r\n");
}

function buildProcessedName(originalFileName) {
  const baseName = originalFileName.toLowerCase().endsWith(".csv")
    ? originalFileName.slice(0, -4)
    : originalFileName;
  return `${baseName}_passo6.csv`;
}

function removeSingleQuotes(value) {
  return String(value ?? "").replace(/'/g, "");
}

function clearProcessedBlob() {
  if (processedBlobUrl) {
    URL.revokeObjectURL(processedBlobUrl);
    processedBlobUrl = null;
  }
}

function formatBytes(size) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}