import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { ClassesView } from './views/ClassesView'
import { ClassDetailView } from './views/ClassDetailView'
import { ProjectView } from './views/ProjectView'
import { SemesterSummaryView } from './views/SemesterSummaryView'
import { LibraryView } from './views/LibraryView'
import { LibraryProjectView } from './views/LibraryProjectView'
import { TutorialOverlay } from './components/tutorial/TutorialOverlay'
import { useReapDeletedClasses } from './db/hooks/useClasses'

function Reaper() {
  useReapDeletedClasses()
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <Reaper />
      <TutorialOverlay />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/classes" replace />} />
          <Route path="classes" element={<ClassesView />} />
          <Route path="classes/:classId" element={<ClassDetailView />} />
          <Route path="classes/:classId/projects/:projectId" element={<ProjectView />} />
          <Route path="classes/:classId/semester" element={<SemesterSummaryView />} />
          <Route path="library" element={<LibraryView />} />
          <Route path="library/:libraryProjectId" element={<LibraryProjectView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
