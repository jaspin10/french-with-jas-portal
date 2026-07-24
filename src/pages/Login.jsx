import { supabase } from '../lib/supabase';

export default function Login() {
  const signIn = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg)',
      }}
    >
      <div
        className="card"
        style={{ width: 360, textAlign: 'center', padding: 40 }}
      >
        <div
          className="logo"
          style={{ justifyContent: 'center', marginBottom: 8 }}
        >
          <div className="logo-badge">FJ</div>
          French With Jas
        </div>
        <p
          style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}
        >
          Your French journey, one day at a time.
        </p>
        <button
          onClick={signIn}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid #ECEDF3',
            background: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            width="20"
            alt=""
          />
          Continue with Google
        </button>
      </div>
    </div>
  );
}
