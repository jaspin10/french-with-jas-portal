import { useState } from 'react'

export default function ThemeTable(props) {
  const homeworks = props.homeworks
  const currentId = props.currentId
  const [open, setOpen] = useState(false)

  const rotation = homeworks.filter(function (h) { return h.in_rotation })

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={function () { setOpen(!open) }}
      >
        <div className="block-title" style={{ marginBottom: 0 }}>
          The 25 themes — your learning path
        </div>
        <button className="reveal-btn">{open ? 'Hide' : 'Show'}</button>
      </div>

      {open && (
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px 6px' }}>#</th>
                <th style={{ padding: '8px 6px' }}>Theme</th>
                <th style={{ padding: '8px 6px' }}>Main tense/mood</th>
                <th style={{ padding: '8px 6px' }}>Communication skill</th>
              </tr>
            </thead>
            <tbody>
              {rotation.map(function (h) {
                const isCurrent = h.id === currentId
                return (
                  <tr
                    key={h.id}
                    style={{
                      borderTop: '1px solid #F0F1F6',
                      background: isCurrent ? 'var(--primary-soft)' : 'transparent',
                      fontWeight: isCurrent ? 700 : 400
                    }}
                  >
                    <td style={{ padding: '8px 6px' }}>
                      {h.id}{isCurrent ? ' ●' : ''}
                    </td>
                    <td style={{ padding: '8px 6px' }}>{h.theme}</td>
                    <td style={{ padding: '8px 6px' }}>{h.tense || '—'}</td>
                    <td style={{ padding: '8px 6px' }}>{h.skill || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            Each theme reuses 25–30% of the previous theme's vocabulary — that's how your French compounds week after week. Corrections are available for every exercise.
          </p>
        </div>
      )}
    </div>
  )
}