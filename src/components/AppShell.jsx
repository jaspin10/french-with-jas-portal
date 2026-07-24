import { NavLink, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const studentNav = [
  { to: '/', label: 'Dashboard' },
  { to: '/homework', label: 'Homework' },
  { to: '/submissions', label: 'Submissions' },
  { to: '/results', label: 'My Results' },
  { to: '/class', label: 'Class' },
];

const teacherNav = [
  { to: '/', label: 'Dashboard' },
  { to: '/students', label: 'Students' },
  { to: '/homework-manager', label: 'Homework Manager' },
  { to: '/inbox', label: 'Submissions Inbox' },
];

export default function AppShell({ profile, isTeacher }) {
  const nav = isTeacher ? teacherNav : studentNav;
  const name = (profile && profile.full_name) || 'Student';
  const initial = name.charAt(0).toUpperCase();

  function handleSignOut() {
    supabase.auth.signOut();
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
                return 'nav-item' + (state.isActive ? ' active' : '');
              }}
            >
              {item.label}
            </NavLink>
          );
        })}

        <div className="nav-section">Account</div>

        <button
          type="button"
          className="nav-item"
          style={{
            width: '100%',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: 14,
          }}
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
    </div>
  );
}
