import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { ClassesView } from './views/ClassesView'
import { ClassDetailView } from './views/ClassDetailView'
import { ProjectView } from './views/ProjectView'
import { SemesterSummaryView } from './views/SemesterSummaryView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/classes" replace />} />
          <Route path="classes" element={<ClassesView />} />
          <Route path="classes/:classId" element={<ClassDetailView />} />
          <Route path="classes/:classId/projects/:projectId" element={<ProjectView />} />
          <Route path="classes/:classId/semester" element={<SemesterSummaryView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
