import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Students() {
  const [students, setStudents] = useState([])
  const [overrides, setOverrides] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const sRes = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('full_name')
    const oRes = await supabase.from('overrides').select('*')
    setStudents(sRes.data || [])
    setOverrides(oRes.data || [])
    setLoading(false)
  }

  useEffect(function () { load() }, [])

  function hasWeekendOverride(studentId) {
    return overrides.some(function (o) {
      return o.student_id === studentId && o.what === 'weekend_tab'
    })
  }

  async function toggleWeekend(student) {
    if (hasWeekendOverride(student.id)) {
      await supabase
        .from('overrides')
        .delete()
        .eq('student_id', student.id)
        .eq('what', 'weekend_tab')
    } else {
      const me = await supabase.auth.getUser()
      await supabase.from('overrides').insert({
        student_id: student.id,
        what: 'weekend_tab',
        granted_by: me.data.user.id
      })
    }
    load()
  }

  async function changeLevel(student, newLevel) {
    await supabase
      .from('profiles')
      .update({ level: newLevel })
      .eq('id', student.id)
    load()
  }

  if (loading) return <div className="card">Loading students...</div>

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Students</h2>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '10px 8px' }}>Student</th>
              <th style={{ padding: '10px 8px' }}>Phone</th>
              <th style={{ padding: '10px 8px' }}>Level</th>
              <th style={{ padding: '10px 8px' }}>Exam date</th>
              <th style={{ padding: '10px 8px' }}>Weekend TCF</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: 20, color: 'var(--text-muted)' }}>
                  No students yet. They appear here after their first Google login.
                </td>
              </tr>
            )}
            {students.map(function (s) {
              const unlocked = hasWeekendOverride(s.id)
              return (
                <tr key={s.id} style={{ borderTop: '1px solid #F0F1F6' }}>
                  <td style={{ padding: '10px 8px', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {s.avatar_url ? (
                        <img src={s.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                      ) : (
                        <div className="avatar" style={{ width: 28, height: 28, fontSize: 12 }}>
                          {(s.full_name || '?').charAt(0)}
                        </div>
                      )}
                      {s.full_name || 'Unnamed'}
                    </div>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {s.phone || <span style={{ color: 'var(--red)' }}>missing</span>}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <select
                      value={s.level}
                      onChange={function (e) { changeLevel(s, e.target.value) }}
                      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E3E5EE' }}
                    >
                      <option value="0">0</option>
                      <option value="1">1</option>
                      <option value="1.5">1.5</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                    </select>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {s.exam_date || <span style={{ color: 'var(--text-muted)' }}>not set</span>}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <button
                      className="reveal-btn"
                      style={unlocked ? { background: 'var(--green-soft)', color: '#157A3D' } : {}}
                      onClick={function () { toggleWeekend(s) }}
                    >
                      {unlocked ? 'Unlocked ✓' : 'Locked — unlock'}
                    </button>
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