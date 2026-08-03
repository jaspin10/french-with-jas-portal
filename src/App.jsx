import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import PhonePrompt from './components/PhonePrompt'
import { useAuth } from './hooks/useAuth'
import Homework from './pages/Homework'
import Students from './pages/Students'
import Submissions from './pages/Submissions'
import Dashboard from './pages/Dashboard'
import HomeworkManager from './pages/HomeworkManager'
import Inbox from './pages/Inbox'
import ClassPage from './pages/ClassPage'
import RecordingsManager from './pages/RecordingsManager'
import MyResults from './pages/MyResults'

function Placeholder(props) {
  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>{props.title}</h2>
      <div className="card">Content coming in M1</div>
    </div>
  )
}

export default function App() {
  const { session, profile, loading } = useAuth()
  const [phoneSaved, setPhoneSaved] = useState(false)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        Loading...
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  const isTeacher = profile && profile.role === 'teacher'
  const needsPhone = profile && !isTeacher && !profile.phone && !phoneSaved

  if (needsPhone) {
    return (
      <PhonePrompt
        profile={profile}
        onDone={function () { setPhoneSaved(true) }}
      />
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell profile={profile} isTeacher={isTeacher} />}>
          {isTeacher ? (
            <>
              <Route path="/" element={<Placeholder title="Professor Dashboard" />} />
              <Route path="/students" element={<Students />} />
              <Route path="/homework-manager" element={<HomeworkManager />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/recordings" element={<RecordingsManager />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Dashboard profile={profile} />} />
              <Route path="/homework" element={<Homework profile={profile} />} />
              <Route path="/submissions" element={<Submissions profile={profile} />} />
              <Route path="/results" element={<MyResults profile={profile} />} />
              <Route path="/class" element={<ClassPage profile={profile} />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}