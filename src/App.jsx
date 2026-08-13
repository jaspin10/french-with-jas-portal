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
import LiveManager from './pages/LiveManager'
import LivePage from './pages/LivePage'
import Challenges from './pages/Challenges'
import { ViewAsProvider, useViewAs } from './lib/viewAs'

function Placeholder(props) {
  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>{props.title}</h2>
      <div className="card">Content coming in M1</div>
    </div>
  )
}

function ViewAsBanner(props) {
  const { setViewAs } = useViewAs()
  return (
    <div className="viewas-banner">
      <span>
        Viewing as <strong>{props.name}</strong> — read only
      </span>
      <button
        className="reveal-btn viewas-exit"
        onClick={function () { setViewAs(null) }}
      >
        Exit student view
      </button>
    </div>
  )
}

function AppRoutes(props) {
  const profile = props.profile
  const isTeacher = props.isTeacher
  const { viewAs } = useViewAs()

  const viewing = isTeacher && viewAs
  const effectiveProfile = viewing ? viewAs : profile

  return (
    <BrowserRouter>
      {viewing ? <ViewAsBanner name={viewAs.full_name || 'student'} /> : null}
      <Routes>
        <Route
          element={
            <AppShell
              profile={effectiveProfile}
              isTeacher={isTeacher && !viewing}
            />
          }
        >
          {isTeacher && !viewing ? (
            <>
              <Route path="/" element={<Placeholder title="Professor Dashboard" />} />
              <Route path="/students" element={<Students />} />
              <Route path="/homework-manager" element={<HomeworkManager />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/recordings" element={<RecordingsManager />} />
              <Route path="/live-manager" element={<LiveManager />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Dashboard profile={effectiveProfile} />} />
              <Route path="/homework" element={<Homework profile={effectiveProfile} />} />
              <Route path="/submissions" element={<Submissions profile={effectiveProfile} />} />
              <Route path="/results" element={<MyResults profile={effectiveProfile} />} />
              <Route path="/class" element={<ClassPage profile={effectiveProfile} />} />
              <Route path="/live" element={<LivePage profile={effectiveProfile} />} />
              <Route path="/challenges" element={<Challenges profile={effectiveProfile} />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
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
    <ViewAsProvider>
      <AppRoutes profile={profile} isTeacher={isTeacher} />
    </ViewAsProvider>
  )
}