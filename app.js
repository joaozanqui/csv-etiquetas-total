const fileInput = document.querySelector("#excelFile");
const processButton = document.querySelector("#processButton");
const downloadButton = document.querySelector("#downloadButton");
const fileSummary = document.querySelector("#fileSummary");
const statusMessage = document.querySelector("#statusMessage");

const supportedExtensions = ["csv"];

const CNPJ_VALUE = "34446018000133";
const COLUMN_CNPJ = 1;
const COLUMN_DEST_TELEFONE1 = 28;
const DEST_TELEFONE1_NULL_REPLACEMENT = "111111111";
const COLUMN_DEST_END = 17;
const COLUMN_DEST_END_NUM = 18;
const COLUMN_DEST_COMPL = 19;
const COLUMN_DESTNOME = 14;
const COLUMN_DEST_EMAIL = 26;
const DEST_EMAIL_NAO_INFORMADO_REPLACEMENT = "naoinformado";
const COLUMN_NFE_DATA = 41;
const EMPTY_COLUMN_REPLACEMENT = "1";

let selectedFile = null;
let processedBlobUrl = null;
let processedFileName = "arquivo_passo6.csv";

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
  downloadButton.disabled = true;
});

processButton.addEventListener("click", async () => {
  if (!selectedFile) {
    statusMessage.textContent = "Selecione um arquivo CSV antes de continuar.";
    return;
  }

  processButton.disabled = true;
  statusMessage.textContent = "Processando arquivo...";

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
    const processedRows = sortByDestNome(withEmail);
    const csvOutput = buildCsv(processedRows, delimiter);
    const dateValue = processedRows.length > 1 ? String(processedRows[1][COLUMN_NFE_DATA] ?? "").trim() : "";
    processedFileName = dateValue ? `CSV_TOTAL_${formatDateDDMMYYYY(dateValue)}.csv` : "CSV_TOTAL.csv";

    clearProcessedBlob();
    const excelFriendlyOutput = `\uFEFF${csvOutput}`;
    processedBlobUrl = URL.createObjectURL(new Blob([excelFriendlyOutput], { type: "text/csv;charset=utf-8;" }));
    downloadButton.disabled = false;
    statusMessage.textContent = "Passos 1-6 concluidos: aspas simples removidas, CNPJ preenchido, DestTelefone1 tratada, endereços preenchidos, DestEMAIL normalizado e linhas ordenadas por DESTNOME.";
  } catch (error) {
    downloadButton.disabled = true;
    statusMessage.textContent = `Falha no processamento: ${error.message}`;
  } finally {
    processButton.disabled = false;
  }
});

downloadButton.addEventListener("click", () => {
  if (!processedBlobUrl) {
    statusMessage.textContent = "Ainda nao existe arquivo processado para download.";
    return;
  }

  const link = document.createElement("a");
  link.href = processedBlobUrl;
  link.download = processedFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  statusMessage.textContent = "Download iniciado com sucesso.";
});

function resetState() {
  clearProcessedBlob();
  fileSummary.innerHTML = `
    <p class="summary-label">Nenhum arquivo selecionado</p>
    <p class="summary-value">Escolha um arquivo CSV para iniciar novamente do zero.</p>
  `;
  statusMessage.textContent = "Processamento reiniciado do zero.";
  processButton.disabled = true;
  downloadButton.disabled = true;
}

resetState();

function formatDateDDMMYYYY(value) {
  // ISO: 2026-05-08 → 08_05_2026
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[3]}_${isoMatch[2]}_${isoMatch[1]}`;
  // BR slash: 08/05/2026 → 08_05_2026
  return value.replace(/\//g, "_");
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