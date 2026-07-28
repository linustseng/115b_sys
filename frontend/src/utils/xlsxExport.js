const encoder = new TextEncoder();

function textBytes_(value) {
  return encoder.encode(String(value == null ? "" : value));
}

function concatBytes_(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function u16_(value) {
  const out = new Uint8Array(2);
  out[0] = value & 0xff;
  out[1] = (value >>> 8) & 0xff;
  return out;
}

function u32_(value) {
  const out = new Uint8Array(4);
  out[0] = value & 0xff;
  out[1] = (value >>> 8) & 0xff;
  out[2] = (value >>> 16) & 0xff;
  out[3] = (value >>> 24) & 0xff;
  return out;
}

let crcTable_ = null;

function getCrcTable_() {
  if (crcTable_) {
    return crcTable_;
  }
  crcTable_ = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable_[n] = c >>> 0;
  }
  return crcTable_;
}

function crc32_(bytes) {
  const table = getCrcTable_();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime_(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

export function createZipBytes(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime_();

  files.forEach((file) => {
    const nameBytes = textBytes_(file.name);
    const data = file.data instanceof Uint8Array ? file.data : textBytes_(file.data);
    const crc = crc32_(data);
    const localHeader = concatBytes_([
      u32_(0x04034b50),
      u16_(20),
      u16_(0x0800),
      u16_(0),
      u16_(dosTime),
      u16_(dosDate),
      u32_(crc),
      u32_(data.length),
      u32_(data.length),
      u16_(nameBytes.length),
      u16_(0),
      nameBytes,
    ]);
    localParts.push(localHeader, data);

    const centralHeader = concatBytes_([
      u32_(0x02014b50),
      u16_(20),
      u16_(20),
      u16_(0x0800),
      u16_(0),
      u16_(dosTime),
      u16_(dosDate),
      u32_(crc),
      u32_(data.length),
      u32_(data.length),
      u16_(nameBytes.length),
      u16_(0),
      u16_(0),
      u16_(0),
      u16_(0),
      u32_(0),
      u32_(offset),
      nameBytes,
    ]);
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  });

  const centralDirectory = concatBytes_(centralParts);
  const endRecord = concatBytes_([
    u32_(0x06054b50),
    u16_(0),
    u16_(0),
    u16_(files.length),
    u16_(files.length),
    u32_(centralDirectory.length),
    u32_(offset),
    u16_(0),
  ]);

  return concatBytes_([...localParts, centralDirectory, endRecord]);
}

function escapeXml_(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName_(index) {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function normalizeSheetName_(value) {
  return String(value || "Sheet1").replace(/[\\/?*\[\]:]/g, " ").slice(0, 31) || "Sheet1";
}

function buildWorksheetXml_(rows) {
  const xmlRows = rows
    .map((row, rowIndex) => {
      const r = rowIndex + 1;
      const cells = row
        .map((value, colIndex) => {
          const ref = `${columnName_(colIndex)}${r}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml_(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>${xmlRows}</sheetData>
</worksheet>`;
}

export function createXlsxBytes({ sheetName = "Sheet1", rows = [], sheets = null }) {
  const normalizedSheets = (Array.isArray(sheets) && sheets.length ? sheets : [{ sheetName, rows }]).map(
    (sheet, index) => ({
      sheetName: normalizeSheetName_(sheet && sheet.sheetName ? sheet.sheetName : `Sheet${index + 1}`),
      rows: Array.isArray(sheet && sheet.rows) ? sheet.rows : [],
    })
  );
  const worksheetOverrides = normalizedSheets
    .map(
      (_, index) =>
        `  <Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("\n");
  const workbookSheets = normalizedSheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml_(sheet.sheetName)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");
  const workbookRelationships = normalizedSheets
    .map(
      (_, index) =>
        `  <Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("\n");
  const files = [
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${worksheetOverrides}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${workbookSheets}</sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${workbookRelationships}
  <Relationship Id="rId${normalizedSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      name: "xl/styles.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`,
    },
    ...normalizedSheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: buildWorksheetXml_(sheet.rows),
    })),
  ];
  return createZipBytes(files);
}

export function downloadXlsx({ filename, sheetName, rows, sheets }) {
  const bytes = createXlsxBytes({ sheetName, rows, sheets });
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
