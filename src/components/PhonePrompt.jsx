import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function PhonePrompt({ profile, onDone }) {
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function isValidPhone(value) {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }

  async function save() {
    if (!isValidPhone(phone)) {
      setError('Please enter a valid phone number (at least 10 digits).');
      return;
    }
    setSaving(true);
    setError('');
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ phone: phone.trim() })
      .eq('id', profile.id);
    setSaving(false);
    if (dbError) {
      setError('Could not save. Please try again.');
      return;
    }
    onDone();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100,
      }}
    >
      <div className="card" style={{ width: 380, padding: 32 }}>
        <div className="logo" style={{ marginBottom: 8 }}>
          <div className="logo-badge">FJ</div>
          French With Jas
        </div>
        <h3 style={{ marginBottom: 8 }}>One last step</h3>
        <p
          style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}
        >
          Please add your phone number to complete your registration. Jas uses
          it to reach you about classes.
        </p>
        <input
          className="search"
          style={{ width: '100%', marginBottom: 8 }}
          type="tel"
          placeholder="+1 604 555 1234"
          value={phone}
          onChange={function (e) {
            setPhone(e.target.value);
          }}
        />
        {error && (
          <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>
            {error}
          </p>
        )}
        <button
          onClick={save}
          disabled={saving}
          style={{
            width: '100%',
            marginTop: 8,
            padding: '12px 16px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--primary)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Complete registration'}
        </button>
      </div>
    </div>
  );
}
