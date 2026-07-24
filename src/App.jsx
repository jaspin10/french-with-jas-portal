import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import { useAuth } from './hooks/useAuth';
import { useState } from 'react';
import PhonePrompt from './components/PhonePrompt';

function Placeholder({ title }) {
  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>{title}</h2>
      <div className="card">Content coming in M1 🚧</div>
    </div>
  );
}

export default function App() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}
      >
        Loading…
      </div>
    );
  }

  if (!session) return <Login />;
  if (needsPhone) {
    return (
      <PhonePrompt
        profile={profile}
        onDone={function () {
          setPhoneSaved(true);
        }}
      />
    );
  }

  const isTeacher = profile?.role === 'teacher';
  const [phoneSaved, setPhoneSaved] = useState(false);
  const needsPhone = profile && !isTeacher && !profile.phone && !phoneSaved;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell profile={profile} isTeacher={isTeacher} />}>
          {isTeacher ? (
            <>
              <Route
                path="/"
                element={<Placeholder title="Professor Dashboard" />}
              />
              <Route
                path="/students"
                element={<Placeholder title="Students" />}
              />
              <Route
                path="/homework-manager"
                element={<Placeholder title="Homework Manager" />}
              />
              <Route
                path="/inbox"
                element={<Placeholder title="Submissions Inbox" />}
              />
            </>
          ) : (
            <>
              <Route path="/" element={<Placeholder title="Dashboard" />} />
              <Route
                path="/homework"
                element={<Placeholder title="Homework" />}
              />
              <Route
                path="/submissions"
                element={<Placeholder title="Submissions" />}
              />
              <Route
                path="/results"
                element={<Placeholder title="My Results" />}
              />
              <Route path="/class" element={<Placeholder title="Class" />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
