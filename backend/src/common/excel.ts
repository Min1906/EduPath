import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

export function cleanNis(val: any): string {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();
  // If Excel exported integer as float like '10001.0' or '10001.00'
  if (/^\d+\.0+$/.test(str)) {
    str = str.split('.')[0];
  }
  return str;
}

export function cleanNumber(val: any): number | null {
  if (val === undefined || val === null) return null;
  const str = String(val).trim().replace(',', '.');
  if (str === '') return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

export function cleanString(val: any): string {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

export function parseWorkbook(file?: Express.Multer.File): Record<string, any>[] {
  if (!file) throw new BadRequestException('File wajib diunggah');
  const extension = file.originalname.toLowerCase().split('.').pop();
  if (!['xlsx', 'xls', 'csv'].includes(extension ?? '')) {
    throw new BadRequestException('Format file harus .xlsx, .xls, atau .csv');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new BadRequestException('Ukuran file maksimum 10 MB');
  }

  const workbook = XLSX.read(file.buffer, { type: 'buffer', raw: false, cellDates: true });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return [];
  }

  // Find the first sheet that has rows
  let targetSheet: XLSX.WorkSheet | null = null;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (sheet && sheet['!ref']) {
      targetSheet = sheet;
      break;
    }
  }

  if (!targetSheet) {
    targetSheet = workbook.Sheets[workbook.SheetNames[0]];
  }
  if (!targetSheet) return [];

  const matrix = XLSX.utils.sheet_to_json<any[]>(targetSheet, { header: 1, defval: '', raw: false });
  if (!matrix || matrix.length === 0) return [];

  // Known header markers for intelligent header row detection
  const headerMarkers = ['nis', 'nama', 'no', 'name', 'kelas', 'gender', 'jk', 'semester', 'tka', 'r (realistic)', 'realistic', 'nip', 'nik', 'mapel'];

  let headerIndex = matrix.findIndex((row) => {
    if (!Array.isArray(row)) return false;
    const nonEmpties = row.filter((cell) => String(cell ?? '').trim() !== '');
    if (nonEmpties.length === 0) return false;
    const lowerCells = nonEmpties.map((c) => String(c).toLowerCase().trim());
    const hasMarker = lowerCells.some((c) => headerMarkers.some((marker) => c.includes(marker)));
    return hasMarker || nonEmpties.length >= 2;
  });

  if (headerIndex < 0) {
    // Fallback: first row with at least 1 cell
    headerIndex = matrix.findIndex((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''));
  }

  if (headerIndex < 0) return [];

  const headers = matrix[headerIndex].map((value) => String(value ?? '').trim());

  return matrix
    .slice(headerIndex + 1)
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row) => {
      const obj: Record<string, any> = {};
      headers.forEach((header, index) => {
        if (header) {
          obj[header] = row[index] !== undefined && row[index] !== null ? String(row[index]).trim() : '';
        }
      });
      return obj;
    });
}

export function workbookBuffer(sheetName: string, rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

