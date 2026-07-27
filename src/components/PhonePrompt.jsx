import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PhonePrompt(props) {
  const profile = props.profile
  const onDone = props.onDone
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(function () {
    if (inputRef.current) {
      setTimeout(function () {
        inputRef.current.focus()
      }, 300)
    }
  }, [])

  function isValidPhone(value) {
    const digits = value.replace(/\D/g, '')
    return digits.length >= 10 && digits.length <= 15
  }

  async function save() {
    if (!isValidPhone(phone)) {
      setError('Please enter a valid phone number (at least 10 digits).')
      return
    }
    setSaving(true)
    setError('')
    const res = await supabase
      .from('profiles')
      .update({ phone: phone.trim() })
      .eq('id', profile.id)
    setSaving(false)
    if (res.error) {
      setError('Could not save. Please try again.')
      return
    }
    onDone()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        paddingLeft: 16,
        paddingRight: 16
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 380, padding: 32 }}>
        <div className="logo" style={{ marginBottom: 8 }}>
          <div className="logo-badge">FJ</div>
          French With Jas
        </div>
        <h3 style={{ marginBottom: 8 }}>One last step</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
          Please add your phone number to complete your registration. Jas uses it to reach you about classes.
        </p>
        <input
          ref={inputRef}
          className="solve-input"
          style={{ width: '100%', marginBottom: 8, minHeight: 0, fontSize: 16 }}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+1 604 555 1234"
          value={phone}
          onChange={function (e) { setPhone(e.target.value) }}
        />
        {error && (
          <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</p>
        )}
        <button
          onClick={save}
          disabled={saving}
          style={{
            width: '100%', marginTop: 8, padding: '14px 16px',
            borderRadius: 10, border: 'none',
            background: 'var(--primary)', color: '#fff',
            fontWeight: 600, fontSize: 15, cursor: 'pointer',
            opacity: saving ? 0.6 : 1
          }}
        >
          {saving ? 'Saving...' : 'Complete registration'}
        </button>
      </div>
    </div>
  )
}