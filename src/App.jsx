import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import PhonePrompt from './components/PhonePrompt'
import { useAuth } from './hooks/useAuth'
import Homework from './pages/Homework'

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
              <Route path="/students" element={<Placeholder title="Students" />} />
              <Route path="/homework-manager" element={<Placeholder title="Homework Manager" />} />
              <Route path="/inbox" element={<Placeholder title="Submissions Inbox" />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Placeholder title="Dashboard" />} />
              <Route path="/homework" element={<Homework profile={profile} />} />
              <Route path="/submissions" element={<Placeholder title="Submissions" />} />
              <Route path="/results" element={<Placeholder title="My Results" />} />
              <Route path="/class" element={<Placeholder title="Class" />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}