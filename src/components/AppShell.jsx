import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const studentNav = [
  { to: '/', label: 'Dashboard', icon: 'D' },
  { to: '/homework', label: 'Homework', icon: 'H' },
  { to: '/my-tenses', label: 'My Tenses', icon: 'T' },
  { to: '/submissions', label: 'Submissions', icon: 'S' },
  { to: '/results', label: 'My Results', icon: 'R' },
  { to: '/class', label: 'Class', icon: 'C' },
]

const teacherNav = [
  { to: '/', label: 'Dashboard', icon: 'D' },
  { to: '/students', label: 'Students', icon: 'S' },
  { to: '/homework-manager', label: 'Homework Manager', icon: 'H' },
  { to: '/inbox', label: 'Submissions Inbox', icon: 'I' },
]

export default function AppShell({ profile, isTeacher }) {
  const nav = isTeacher ? teacherNav : studentNav
  const name = (profile && profile.full_name) || 'Student'
  const initial = name.charAt(0).toUpperCase()

  function handleSignOut() {
    supabase.auth.signOut()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-badge">FJ</div>
          French With Jas
        </div>

        <div className="nav-section">{isTeacher ? 'Professor' : 'Menu'}</div>

        {nav.map(function (item) {
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={function (state) {
                return 'nav-item' + (state.isActive ? ' active' : '')
              }}
            >
              {item.label}
            </NavLink>
          )
        })}

        <div className="nav-section">Account</div>

        <button
          type="button"
          className="nav-item"
          style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14 }}
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <input className="search" placeholder="Search..." />

          <div className="topbar-right">
            {profile && profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                style={{ width: 38, height: 38, borderRadius: '50%' }}
              />
            ) : (
              <div className="avatar">{initial}</div>
            )}
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav">
        {nav.map(function (item) {
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={function (state) {
                return state.isActive ? 'active' : ''
              }}
            >
              <span className="bn-icon">{item.icon}</span>
              {item.label.split(' ')[0]}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}