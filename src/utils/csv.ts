import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: result => {
        const headers = result.meta.fields ?? []
        resolve({ headers, rows: result.data })
      },
      error: err => reject(err),
    })
  })
}

export function parseXlsxFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: '',
          raw: false,
        })
        const headers = jsonRows.length > 0 ? Object.keys(jsonRows[0]) : []
        resolve({ headers, rows: jsonRows })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

export function parseSpreadsheetFile(file: File): Promise<ParsedCsv> {
  if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
    return parseXlsxFile(file)
  }
  return parseCsvFile(file)
}

export function detectNameColumn(headers: string[]): string | null {
  return headers.find(h => /name/i.test(h)) ?? headers[0] ?? null
}
