import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { ExtractedCompetency } from './claude'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// ─── Text extraction ──────────────────────────────────────────────────────────

async function extractTextFromPdf(buf: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
  const lines: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    // Group items by approximate Y position so they form natural lines
    const byY = new Map<number, string[]>()
    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = Math.round((item as { transform: number[] }).transform[5])
      if (!byY.has(y)) byY.set(y, [])
      byY.get(y)!.push((item as { str: string }).str)
    }
    // Sort descending Y (top of page first in PDF coords)
    const sorted = [...byY.entries()].sort((a, b) => b[0] - a[0])
    for (const [, parts] of sorted) {
      const line = parts.join(' ').trim()
      if (line) lines.push(line)
    }
    lines.push('')  // blank line between pages
  }
  return lines.join('\n')
}

async function extractTextFromDocx(buf: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result  = await mammoth.extractRawText({ arrayBuffer: buf })
  return result.value
}

// ─── Pattern matching ─────────────────────────────────────────────────────────

// Section header keywords that signal a competency list follows
const SECTION_KEYWORDS = [
  'learning outcome', 'course learning outcome', 'unit learning outcome',
  'program learning outcome', 'programme learning outcome',
  'subject learning outcome', 'module learning outcome',
  'graduate attribute', 'graduate capability',
  'competenc', 'course objective', 'learning objective',
  'intended learning', 'student will', 'students will',
]

// Keywords that signal we've left the competency section (new major section)
const EXIT_KEYWORDS = [
  'assessment', 'assignment', 'submission', 'due date', 'weighting',
  'schedule', 'week ', 'timetable', 'delivery mode',
  'resource', 'textbook', 'reading', 'bibliography',
  'policy', 'plagiarism', 'academic integrity',
  'prerequisite', 'co-requisite', 'credit point',
  'contact hour', 'lecture', 'tutorial', 'workshop',
  'staff', 'coordinator', 'lecturer', 'teacher',
  'rationale', 'unit description', 'course description',
  'note:', 'please note',
]

// Coded item prefixes: CLO1, LO 2, GA-3, ULO4, PLO 5, ILO6, MLO7
const CODE_RE = /^(CLO|ULO|LO|GA|PLO|ILO|MLO|SLO|GLO|CO)\s*[-–—]?\s*(\d+)\s*[:.)]\s*/i

// Numbered/bulleted item
const BULLET_RE = /^(?:\(?\d{1,2}[.)]\s*|[•·▪▸\-–—*]\s+)/

function isOutcomeHeader(line: string): boolean {
  const lower = line.toLowerCase()
  return SECTION_KEYWORDS.some(kw => lower.includes(kw))
}

function isExitHeader(line: string): boolean {
  if (line.length > 80) return false   // long lines are content, not headings
  const lower = line.toLowerCase()
  return EXIT_KEYWORDS.some(kw => lower.includes(kw))
}

// A short line with no bullet/number that looks like a section heading
function looksLikeSectionHeading(line: string): boolean {
  if (line.length > 60) return false
  if (BULLET_RE.test(line)) return false
  if (CODE_RE.test(line)) return false
  // All caps or Title Case short line = heading
  const isAllCaps  = line === line.toUpperCase() && /[A-Z]/.test(line)
  const isTitleish = /^[A-Z][^a-z]{0,3}/.test(line) && line.split(' ').length <= 6
  return isAllCaps || isTitleish
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/^\W+/, '').trim()
}

function toNameAndDesc(rawText: string): ExtractedCompetency {
  const text = cleanText(rawText)

  // Coded: CLO1, LO2, GA3 etc.
  const codeMatch = text.match(CODE_RE)
  if (codeMatch) {
    const code = `${codeMatch[1].toUpperCase()}${codeMatch[2]}`
    const desc = text.slice(codeMatch[0].length).trim()
    return { name: code, description: desc || text }
  }

  // Plain numbered/bulleted — first 5 words become the name
  const stripped = text.replace(BULLET_RE, '').trim()
  const words    = stripped.split(/\s+/)
  const name     = words.slice(0, 5).join(' ').replace(/[,;:]+$/, '')
  return { name, description: stripped }
}

function parseCompetenciesFromText(text: string): ExtractedCompetency[] {
  const lines   = text.split(/\r?\n/)
  const results: ExtractedCompetency[] = []
  let inSection   = false
  let buffer      = ''
  let blankCount  = 0
  let itemsFound  = 0   // items collected in this section

  function flush() {
    const t = cleanText(buffer)
    // Require meaningful length — filters out stray fragments
    if (t.length > 20) { results.push(toNameAndDesc(t)); itemsFound++ }
    buffer = ''
  }

  function exitSection() {
    flush()
    inSection  = false
    blankCount = 0
    itemsFound = 0
  }

  for (const raw of lines) {
    const line = raw.trim()

    // ── Section entry ────────────────────────────────────────────────────
    if (isOutcomeHeader(line)) {
      if (inSection) flush()
      inSection  = true
      blankCount = 0
      itemsFound = 0
      continue
    }

    if (!inSection) continue

    // ── Section exit conditions ──────────────────────────────────────────

    // Empty line
    if (line === '') {
      blankCount++
      // Exit after 1 blank line if we already have coded items (CLO-style lists
      // are tightly packed; a blank means the section ended)
      const hasCodedItems = results.some(r => /^(CLO|ULO|LO|GA|PLO|ILO|MLO|SLO|GLO|CO)\d+$/.test(r.name))
      if (blankCount >= 1 && itemsFound > 0 && hasCodedItems) { exitSection(); continue }
      if (blankCount >= 2) { exitSection(); continue }
      continue
    }
    blankCount = 0

    // A known non-competency section heading
    if (isExitHeader(line)) { exitSection(); continue }

    // A short title-case or all-caps heading after we've already collected items
    if (itemsFound > 0 && looksLikeSectionHeading(line) && !isOutcomeHeader(line)) {
      exitSection(); continue
    }

    // ── Collect item ─────────────────────────────────────────────────────

    const isItem = CODE_RE.test(line) || BULLET_RE.test(line)

    if (isItem) {
      flush()
      buffer = line
    } else if (buffer) {
      // Continuation / wrapped text
      buffer += ' ' + line
    }
    // Non-item, non-buffer lines (intro sentences etc.) are silently skipped
  }
  flush()

  return results
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type ParseResult =
  | { ok: true;  competencies: ExtractedCompetency[] }
  | { ok: false; error: string }

export async function parseCompetenciesFromFile(file: File): Promise<ParseResult> {
  const { type, name } = file
  const buf = await file.arrayBuffer()

  let text = ''

  try {
    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      text = await extractTextFromPdf(buf)
    } else if (
      type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      name.endsWith('.docx')
    ) {
      text = await extractTextFromDocx(buf)
    } else if (type === 'text/plain' || name.endsWith('.txt')) {
      text = new TextDecoder().decode(buf)
    } else {
      return {
        ok: false,
        error: 'Unsupported file type. Please use a PDF, Word (.docx), or plain text file.',
      }
    }
  } catch (err) {
    return { ok: false, error: `Could not read file: ${err instanceof Error ? err.message : String(err)}` }
  }

  if (!text.trim()) {
    return { ok: false, error: 'No text could be extracted from this file. If it is a scanned PDF, text extraction is not supported without an API key.' }
  }

  const competencies = parseCompetenciesFromText(text)

  if (competencies.length === 0) {
    return {
      ok: false,
      error: 'No learning outcomes or competencies found. Make sure the document contains a section headed "Learning Outcomes", "Graduate Attributes", or similar. You can also add competencies manually.',
    }
  }

  return { ok: true, competencies }
}
