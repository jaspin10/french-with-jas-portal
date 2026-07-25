import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function HomeworkManager() {
  const [homeworks, setHomeworks] = useState([])
  const [cycle, setCycle] = useState(null)
  const [contentCounts, setContentCounts] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    const hRes = await supabase.from('homeworks').select('*').order('id')
    const cRes = await supabase
      .from('global_cycle').select('*').eq('id', 1).maybeSingle()
    const ccRes = await supabase.from('homework_content').select('homework_id')
    const counts = {}
    ;(ccRes.data || []).forEach(function (row) {
      counts[row.homework_id] = (counts[row.homework_id] || 0) + 1
    })
    setHomeworks(hRes.data || [])
    setCycle(cRes.data)
    setContentCounts(counts)
    setLoading(false)
  }

  useEffect(function () { load() }, [])

  function nextInRotation(currentId) {
    // 3 -> 4 -> ... -> 25 -> 3 (HW 1 and 2 never rotate)
    if (currentId >= 25) return 3
    if (currentId < 3) return 3
    return currentId + 1
  }

  async function advanceWeek() {
    const next = nextInRotation(cycle.current_homework_id)
    const isWrap = cycle.current_homework_id >= 25
    const ok = window.confirm(
      'Advance the global cycle to Week ' + next + '? ' +
      'Every student in Levels 2-4 will immediately receive this homework.' +
      (isWrap ? ' This also starts a NEW ROTATION CYCLE: all verb tests reset for fresh attempts.' : '')
    )
    if (!ok) return
    const updates = {
      current_homework_id: next,
      week_started_on: new Date().toISOString().slice(0, 10)
    }
    if (isWrap) {
      updates.cycle_number = (cycle.cycle_number || 1) + 1
    }
    await supabase
      .from('global_cycle')
      .update(updates)
      .eq('id', 1)
    load()
  }

  function startEditing(hw) {
    setEditingId(hw.id)
    setDraftMessage(hw.custom_message || '')
  }

  async function saveMessage(hw) {
    await supabase
      .from('homeworks')
      .update({ custom_message: draftMessage || null })
      .eq('id', hw.id)
    setEditingId(null)
    load()
  }

  if (loading) return <div className="card">Loading...</div>

  const current = cycle ? cycle.current_homework_id : null

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Homework Manager</h2>

      <div className="card" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="stat-value" style={{ fontSize: 20 }}>
            Current: Week {current} — {
              (homeworks.find(function (h) { return h.id === current }) || {}).theme
            }
          </div>
          <div className="stat-label">
            Week started {cycle ? cycle.week_started_on : '—'} · Next in rotation: Week {cycle ? nextInRotation(current) : '—'}
          </div>
        </div>
        <button className="sub-btn" onClick={advanceWeek}>
          Advance to next week
        </button>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '10px 8px' }}>#</th>
              <th style={{ padding: '10px 8px' }}>Theme</th>
              <th style={{ padding: '10px 8px' }}>Tense</th>
              <th style={{ padding: '10px 8px' }}>Skill</th>
              <th style={{ padding: '10px 8px' }}>Content</th>
              <th style={{ padding: '10px 8px' }}>Custom message</th>
            </tr>
          </thead>
          <tbody>
            {homeworks.map(function (hw) {
              const isCurrent = hw.id === current
              const count = contentCounts[hw.id] || 0
              return (
                <tr
                  key={hw.id}
                  style={{
                    borderTop: '1px solid #F0F1F6',
                    background: isCurrent ? 'var(--primary-soft)' : 'transparent'
                  }}
                >
                  <td style={{ padding: '10px 8px', fontWeight: 800 }}>
                    {hw.id}
                    {isCurrent && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--primary)' }}>
                        ● NOW
                      </span>
                    )}
                    {!hw.in_rotation && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                        (no rotation)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px', fontWeight: 600 }}>{hw.theme}</td>
                  <td style={{ padding: '10px 8px' }}>{hw.tense || '—'}</td>
                  <td style={{ padding: '10px 8px', fontSize: 13 }}>{hw.skill || '—'}</td>
                  <td style={{ padding: '10px 8px' }}>
                    {count > 0 ? (
                      <span className="pill ontime">{count} items</span>
                    ) : (
                      <span className="pill late">empty</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px', maxWidth: 340 }}>
                    {editingId === hw.id ? (
                      <div>
                        <textarea
                          className="solve-input"
                          value={draftMessage}
                          placeholder="Message students see when this week is assigned..."
                          onChange={function (e) { setDraftMessage(e.target.value) }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button className="reveal-btn" onClick={function () { saveMessage(hw) }}>
                            Save
                          </button>
                          <button
                            className="reveal-btn"
                            style={{ background: '#F0F1F6', color: 'var(--text-muted)' }}
                            onClick={function () { setEditingId(null) }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{ cursor: 'pointer', fontSize: 13, color: hw.custom_message ? 'var(--text)' : 'var(--text-muted)' }}
                        onClick={function () { startEditing(hw) }}
                        title="Click to edit"
                      >
                        {hw.custom_message || 'Click to add a message...'}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}