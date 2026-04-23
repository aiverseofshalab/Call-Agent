import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// ===============================
// PARSE EXCEL / CSV
// ===============================
export function parseExcelFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('Uploaded file not found');
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let workbook;

    if (ext === '.csv') {
      workbook = XLSX.read(fileBuffer.toString('utf8'), {
        type: 'string'
      });
    } else {
      workbook = XLSX.read(fileBuffer, {
        type: 'buffer'
      });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false
    });

    const cleanRows = rows.filter(
      (row) =>
        Array.isArray(row) &&
        row.some((cell) => String(cell).trim() !== '')
    );

    const firstRow = cleanRows[0].map((x) =>
      String(x).toLowerCase().trim()
    );

    const hasHeader =
      firstRow[0]?.includes('name') ||
      firstRow[1]?.includes('phone');

    const dataRows = hasHeader
      ? cleanRows.slice(1)
      : cleanRows;

    const contacts = dataRows
      .map((row, index) => ({
        index,
        name:
          row[0] && String(row[0]).trim()
            ? String(row[0]).trim()
            : `Contact ${index + 1}`,
        phone: row[1] ? String(row[1]).trim() : '',
        originalRow: row
      }))
      .filter((x) => x.phone && isValidPhoneNumber(x.phone));

    return {
      contacts,
      originalData: dataRows,
      headers: hasHeader
        ? cleanRows[0]
        : ['NAME', 'PHONE']
    };
  } catch (error) {
    throw new Error(error.message);
  }
}

// ===============================
// GOOGLE SHEETS COMPATIBLE EXCEL GENERATOR
// ===============================
export function generateUpdatedExcel(
  originalData,
  responses,
  outputPath
) {
  try {
    const map = {};

    responses.forEach((r) => {
      map[String(r.phone_number).trim()] = r;
    });

    const rows = [];

    // Add header row
    const headers = [
      'NAME',
      'PHONE',
      'MATH 12TH PASSED',
      'COURSE SELECTION',
      'CALL STATUS'
    ];
    rows.push(headers);

    // Add data rows
    originalData.forEach((row, index) => {
      const name =
        row[0] && String(row[0]).trim()
          ? String(row[0]).trim()
          : `Contact ${index + 1}`;

      const phone = row[1]
        ? String(row[1]).trim()
        : '';

      const r = map[phone];

      // Q1: MATH 12TH PASSED
      let mathStatus = '-';
      if (r?.math_12th_passed === true) {
        mathStatus = 'YES';
      } else if (r?.math_12th_passed === false) {
        mathStatus = 'NO';
      }

      // Q2/Q3: COURSE SELECTION
      let courseSelection = '-';
      
      if (r?.engineering_interested === true) {
        courseSelection = 'INTERESTED';
      } else if (r?.engineering_interested === false) {
        // Show the actual course they selected
        const alternative = r?.alternative_course;
        if (alternative === 'Science') {
          courseSelection = 'SCIENCE';
        } else if (alternative === 'Commerce') {
          courseSelection = 'COMMERCE';
        } else if (alternative === 'Arts') {
          courseSelection = 'ARTS';
        } else if (alternative === 'Other') {
          courseSelection = 'OTHER';
        } else {
          courseSelection = 'NOT INTERESTED';
        }
      }

      // Call Status
      let callStatus = (r?.call_status || 'PENDING').toUpperCase();

      rows.push([
        name,
        phone,
        mathStatus,
        courseSelection,
        callStatus
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    ws['!cols'] = [
      { wch: 28 },
      { wch: 18 },
      { wch: 22 },
      { wch: 28 },
      { wch: 18 }
    ];

    const range = XLSX.utils.decode_range(ws['!ref']);

    // =============================================
    // HEADER STYLING (Row 1)
    // =============================================
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[cellAddress]) continue;
      
      ws[cellAddress].s = {
        font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1F4E78' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }

    // =============================================
    // BORDER & ALIGNMENT FOR ALL DATA CELLS
    // =============================================
    for (let R = 1; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;
        
        if (!ws[cellAddress].s) ws[cellAddress].s = {};
        ws[cellAddress].s.alignment = { horizontal: 'center', vertical: 'center' };
        ws[cellAddress].s.border = {
          top: { style: 'thin', color: { rgb: 'CCCCCC' } },
          bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
          left: { style: 'thin', color: { rgb: 'CCCCCC' } },
          right: { style: 'thin', color: { rgb: 'CCCCCC' } }
        };
      }
    }

    // =============================================
    // COLOR MATH STATUS COLUMN (C)
    // YES = Green, NO = Red
    // =============================================
    for (let R = 2; R <= rows.length; R++) {
      const cellAddress = `C${R}`;
      if (ws[cellAddress]) {
        ws[cellAddress].s = ws[cellAddress].s || {};
        
        if (ws[cellAddress].v === 'YES') {
          ws[cellAddress].s.fill = { fgColor: { rgb: 'C6EFCE' } };
          ws[cellAddress].s.font = { bold: true, color: { rgb: '006100' } };
        } else if (ws[cellAddress].v === 'NO') {
          ws[cellAddress].s.fill = { fgColor: { rgb: 'FFC7CE' } };
          ws[cellAddress].s.font = { bold: true, color: { rgb: '9C0006' } };
        }
      }
    }

    // =============================================
    // COLOR COURSE SELECTION COLUMN (D)
    // INTERESTED = Green
    // SCIENCE, COMMERCE, ARTS, OTHER = Red
    // =============================================
    for (let R = 2; R <= rows.length; R++) {
      const cellAddress = `D${R}`;
      if (ws[cellAddress]) {
        ws[cellAddress].s = ws[cellAddress].s || {};
        
        if (ws[cellAddress].v === 'INTERESTED') {
          ws[cellAddress].s.fill = { fgColor: { rgb: 'C6EFCE' } };
          ws[cellAddress].s.font = { bold: true, color: { rgb: '006100' } };
        } else if (
          ws[cellAddress].v === 'SCIENCE' ||
          ws[cellAddress].v === 'COMMERCE' ||
          ws[cellAddress].v === 'ARTS' ||
          ws[cellAddress].v === 'OTHER'
        ) {
          ws[cellAddress].s.fill = { fgColor: { rgb: 'FFC7CE' } };
          ws[cellAddress].s.font = { bold: true, color: { rgb: '9C0006' } };
        }
      }
    }

    // =============================================
    // COLOR CALL STATUS COLUMN (E)
    // COMPLETED = Green
    // CANCELED = Dark Red
    // FAILED/BUSY/NO-ANSWER = Blue
    // PENDING = Yellow
    // =============================================
    for (let R = 2; R <= rows.length; R++) {
      const cellAddress = `E${R}`;
      if (ws[cellAddress]) {
        ws[cellAddress].s = ws[cellAddress].s || {};
        ws[cellAddress].s.font = { bold: true };
        
        const status = ws[cellAddress].v;
        
        if (status === 'COMPLETED') {
          ws[cellAddress].s.fill = { fgColor: { rgb: 'C6EFCE' } };
          ws[cellAddress].s.font.color = { rgb: '006100' };
        } else if (status === 'CANCELED') {
          ws[cellAddress].s.fill = { fgColor: { rgb: 'FFC7CE' } };
          ws[cellAddress].s.font.color = { rgb: '9C0006' };
        } else if (status === 'FAILED' || status === 'BUSY' || status === 'NO-ANSWER') {
          ws[cellAddress].s.fill = { fgColor: { rgb: 'BDD7EE' } };
          ws[cellAddress].s.font.color = { rgb: '1F4E78' };
        } else if (status === 'PENDING') {
          ws[cellAddress].s.fill = { fgColor: { rgb: 'FFF2CC' } };
          ws[cellAddress].s.font.color = { rgb: '7F6000' };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'SURVEY RESULTS');
    XLSX.writeFile(wb, outputPath, { cellStyles: true, bookType: 'xlsx' });

    return outputPath;
  } catch (error) {
    throw new Error(error.message);
  }
}

// ===============================
// PHONE FORMAT
// ===============================
export function formatPhoneNumber(phone) {
  let cleaned = String(phone).replace(/\D/g, '');

  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }

  return '+' + cleaned;
}

// ===============================
// VALIDATE PHONE
// ===============================
export function isValidPhoneNumber(phone) {
  const digits = String(phone).replace(/\D/g, '');
  return (
    digits.length >= 10 &&
    digits.length <= 15
  );
}