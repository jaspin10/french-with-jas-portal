import { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const studentNav = [
  { to: '/', label: 'Dashboard', icon: 'D' },
  { to: '/homework', label: 'Homework', icon: 'H' },
  { to: '/challenges', label: 'Challenges', icon: 'Ch' },
  { to: '/submissions', label: 'Submissions', icon: 'S' },
  { to: '/results', label: 'My Results', icon: 'R' },
  { to: '/class', label: 'Class', icon: 'C' },
  { to: '/live', label: 'Live', icon: 'L' },
]

const teacherNav = [
  { to: '/', label: 'Dashboard', icon: 'D' },
  { to: '/students', label: 'Students', icon: 'S' },
  { to: '/homework-manager', label: 'Homework Manager', icon: 'H' },
  { to: '/inbox', label: 'Submissions Inbox', icon: 'I' },
  { to: '/recordings', label: 'Recordings', icon: 'R' },
  { to: '/live-manager', label: 'Live Class', icon: 'L' },
]

function getInitialTheme() {
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch (e) {
    // localStorage unavailable, fall through
  }
  return 'light'
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export default function AppShell({ profile, isTeacher }) {
  const nav = isTeacher ? teacherNav : studentNav
  const name = (profile && profile.full_name) || 'Student'
  const initial = name.charAt(0).toUpperCase()
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(function () {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch (e) {
      // ignore storage errors
    }
  }, [theme])

  function handleSignOut() {
    supabase.auth.signOut()
  }

  function handleToggleTheme() {
    setTheme(function (prev) {
      return prev === 'dark' ? 'light' : 'dark'
    })
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
            <button
              type="button"
              className="theme-toggle"
              onClick={handleToggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

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