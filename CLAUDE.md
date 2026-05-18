# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node is at `C:\Program Files\nodejs\` — prefix PowerShell commands with `$env:PATH = "C:\Program Files\nodejs;$env:USERPROFILE\.cargo\bin;$env:PATH"` if node/cargo aren't found.

```bash
npm run dev           # Vite dev server only (browser, http://localhost:5173)
npm run build         # TypeScript check + production Vite build (dist/)
npm run tauri:dev     # Start Vite + open the desktop app (main dev workflow)
npm run tauri:build   # Build distributable .exe installer (release)
npm run lint          # ESLint
```

**Always run `npm run build` to verify TypeScript before considering a change complete.** There are no tests.

### Starting the dev server for preview_start

The preview_start MCP tool can't find node directly. Use the wrapper script:
- `launch.json` points to `start-dev.cmd` via `cmd.exe /c`
- `start-dev.cmd` sets PATH and runs `node node_modules/vite/bin/vite.js --port 5173`

### Desktop app (Tauri)

This is a **Tauri v2 desktop app**, not a browser app. Data lives in the OS WebView storage (`AppData\Roaming\com.gradedesk.app`), completely isolated from Chrome — clearing the browser has no effect.

- Rust backend: `src-tauri/` — minimal, no custom commands needed currently
- Config: `src-tauri/tauri.conf.json` — identifier `com.gradedesk.app`, window 1280×800
- Rust toolchain installed at `%USERPROFILE%\.cargo\bin\`
- Desktop shortcut at `C:\Users\brett\Desktop\GradeDesk.lnk` → runs `gradedesk-launch.cmd`
- `gradedesk-launch.cmd` starts Vite silently then opens `src-tauri\target\debug\app.exe`

When distributing: `npm run tauri:build` → installer at `src-tauri\target\release\bundle\`

## Architecture

### Data layer — Dexie + IndexedDB

All persistence is via a single Dexie database instance (`src/db/db.ts`, named `GradeDesk`). There is no backend. The six tables are:

| Table | Key relationships |
|---|---|
| `classes` | root entity |
| `students` | `classId` → class |
| `projects` | `classId` → class |
| `criteria` | `projectId` → project |
| `marks` | compound index `[studentId+projectId+criterionId]` for O(1) cell lookup |
| `projectSheets` | `projectId` → project; stores raw `ArrayBuffer` of uploaded PDF/image |

**Never query the db directly in views.** All reads go through `useLiveQuery` wrappers in `src/db/hooks/`. Write operations (add, update, delete, bulk) are plain async functions exported from the same hook files — they are *not* hooks themselves.

Cascading deletes (e.g. deleting a class removes students, projects, criteria, marks, sheets) are done inside `db.transaction('rw', [tables...], callback)` in the hook files.

### Marking formula

`calcProjectPercentage` in `src/utils/marks.ts` is the core formula. Criteria weights are normalised at calculation time (divided by `totalWeight`) so they do not need to sum to 1.0 in the DB — the UI warns but never blocks. The semester mark is a straight weighted sum: `Σ(project.semesterWeight × projectPercentage)`. Projects with `semesterWeight: 0` are excluded.

### Routing

React Router v7, client-side only. Four routes, all nested under `<Layout>`:

```
/classes
/classes/:classId
/classes/:classId/projects/:projectId
/classes/:classId/semester
```

### Component conventions

- `src/components/ui/` — unstyled-but-themed primitives (Button, Input, Modal, SlideOver, TabBar, Badge, Spinner). Use these everywhere; don't add inline Tailwind for common patterns.
- `src/components/layout/` — Layout wrapper + collapsible Sidebar with class list nav.
- Feature components live under `src/components/{rubric,marking,classes,students,projects}/`.
- Views (`src/views/`) are thin: they assemble feature components and hold only page-level modal/tab state.

### Styling

**All UI must match the Claude web app aesthetic.** This means: dark layered grays, no pure black, subtle borders, clean typography, and orange as the only accent colour. When adding any new UI — components, modals, tables, forms — reference the existing primitives and palette rather than introducing new colours or patterns.

Tailwind CSS v3 with custom gray shades defined in `tailwind.config.js`:

| Token | Hex | Role |
|---|---|---|
| `gray-950` | `#0f0f10` | Page background |
| `gray-900` | `#18181b` | Sidebar / panel background |
| `gray-850` | `#1f1f22` | Modal / slide-over surface |
| `gray-800` | `#27272a` | Card surface, input background |
| `gray-750` | `#333338` | Elevated card, hover state |
| `gray-700` | `#3f3f46` | Borders |
| `gray-400` | — | Secondary text |
| `orange-500` | — | Primary accent (buttons, active tabs, badges) |
| `emerald-400` | — | Pass ≥ 65% |
| `amber-400` | — | Borderline 50–65% |
| `red-400` | — | Fail < 50% |

Dark mode is forced via `class="dark"` on `<html>` — `darkMode: 'class'` in config. Never use `bg-black`, `bg-white`, or light-mode colours. Border radius on cards/modals is `rounded-xl`; inputs and buttons use `rounded-lg`.

All type-only imports must use `import type { … }` — TypeScript is configured with `verbatimModuleSyntax`.

### CSV import

`src/utils/csv.ts` wraps PapaParse. Drop handler uses native browser `onDrop` events (not dnd-kit). dnd-kit is used **only** for the drag-to-reorder criteria list in `CriteriaEditor`.

### Project sheet files

Uploaded PDFs/images are stored as `ArrayBuffer` in the `projectSheets` Dexie table. Display uses `URL.createObjectURL(new Blob([arrayBuffer], { type: mimeType }))` — revoke the URL on unmount. PDFs render in `<iframe>`, images in `<img>`.
