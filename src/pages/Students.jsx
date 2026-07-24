import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import StudentTenses from '../components/StudentTenses'

function ymd(date) {
  return date.toISOString().slice(0, 10)
}

export default function Students() {
  const [students, setStudents] = useState([])
  const [overrides, setOverrides] = useState([])
  const [checklists, setChecklists] = useState([])
  const [subs, setSubs] = useState([])
  const [cycle, setCycle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  async function load() {
    const sRes = await supabase
      .from('profiles').select('*').eq('role', 'student').order('full_name')
    const oRes = await supabase.from('overrides').select('*')
    const cRes = await supabase.from('checklist_days').select('*')
    const subRes = await supabase
      .from('submissions').select('*').order('submitted_at', { ascending: false })
    const cyRes = await supabase
      .from('global_cycle').select('*').eq('id', 1).maybeSingle()
    setStudents(sRes.data || [])
    setOverrides(oRes.data || [])
    setChecklists(cRes.data || [])
    setSubs(subRes.data || [])
    setCycle(cyRes.data)
    setLoading(false)
  }

  useEffect(function () { load() }, [])

  function hasWeekendOverride(id) {
    return overrides.some(function (o) {
      return o.student_id === id && o.what === 'weekend_tab'
    })
  }

  async function toggleWeekend(student) {
    if (hasWeekendOverride(student.id)) {
      await supabase.from('overrides').delete()
        .eq('student_id', student.id).eq('what', 'weekend_tab')
    } else {
      const me = await supabase.auth.getUser()
      await supabase.from('overrides').insert({
        student_id: student.id, what: 'weekend_tab', granted_by: me.data.user.id
      })
    }
    load()
  }

  async function changeLevel(student, newLevel) {
    await supabase.from('profiles').update({ level: newLevel }).eq('id', student.id)
    load()
  }

  function checklistPct(id) {
    const todayStr = ymd(new Date())
    const rows = checklists.filter(function (c) {
      return c.student_id === id && c.day <= todayStr
    })
    if (rows.length === 0) return null
    const complete = rows.filter(function (c) {
      return c.class_attended && c.block1_done && c.block2_done && c.block3_done
    }).length
    return Math.round((complete / rows.length) * 100)
  }

  function lastSubmission(id) {
    return subs.find(function (s) { return s.student_id === id }) || null
  }

  function submittedThisWeek(id) {
    if (!cycle) return false
    return subs.some(function (s) {
      return s.student_id === id &&
        s.homework_id === cycle.current_homework_id &&
        new Date(s.submitted_at) >= new Date(cycle.week_started_on)
    })
  }

  if (loading) return <div className="card">Loading students...</div>

  const missingCount = students.filter(function (s) {
    return !submittedThisWeek(s.id)
  }).length

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Students</h2>

      <div className="cl-stats">
        <div className="card cl-stat">
          <div className="stat-value">{students.length}</div>
          <div className="stat-label">Active students</div>
        </div>
        <div className="card cl-stat">
          <div className="stat-value" style={missingCount > 0 ? { color: 'var(--red)' } : {}}>
            {missingCount}
          </div>
          <div className="stat-label">No submission this week</div>
        </div>
        <div className="card cl-stat">
          <div className="stat-value">{cycle ? 'W' + cycle.current_homework_id : '—'}</div>
          <div className="stat-label">Current global week</div>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '10px 8px' }}>Student</th>
              <th style={{ padding: '10px 8px' }}>Phone</th>
              <th style={{ padding: '10px 8px' }}>Level</th>
              <th style={{ padding: '10px 8px' }}>Exam date</th>
              <th style={{ padding: '10px 8px' }}>Checklist</th>
              <th style={{ padding: '10px 8px' }}>This week</th>
              <th style={{ padding: '10px 8px' }}>Last submission</th>
              <th style={{ padding: '10px 8px' }}>Weekend TCF</th>
              <th style={{ padding: '10px 8px' }}>Tenses</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr>
                <td colSpan="9" style={{ padding: 20, color: 'var(--text-muted)' }}>
                  No students yet.
                </td>
              </tr>
            )}
            {students.map(function (s) {
              const unlocked = hasWeekendOverride(s.id)
              const pct = checklistPct(s.id)
              const last = lastSubmission(s.id)
              const thisWeek = submittedThisWeek(s.id)
              return (
                <Fragment key={s.id}>
                <tr style={{ borderTop: '1px solid #F0F1F6' }}>
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
                    {pct == null ? (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    ) : (
                      <span style={{ fontWeight: 700, color: pct >= 70 ? '#157A3D' : pct >= 40 ? 'var(--amber)' : 'var(--red)' }}>
                        {pct}%
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <span className={'pill ' + (thisWeek ? 'ontime' : 'late')}>
                      {thisWeek ? 'SUBMITTED' : 'MISSING'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', fontSize: 13, color: 'var(--text-muted)' }}>
                    {last
                      ? new Date(last.submitted_at).toLocaleDateString() + ' (' + last.kind + ')'
                      : 'never'}
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
                  <td style={{ padding: '10px 8px' }}>
                    <button
                      className="reveal-btn"
                      onClick={function () {
                        setExpandedId(expandedId === s.id ? null : s.id)
                      }}
                    >
                      {expandedId === s.id ? 'Hide' : 'View'}
                    </button>
                  </td>
                </tr>
                {expandedId === s.id ? (
                  <tr>
                    <td colSpan="9" style={{ padding: '10px 8px', background: '#FAFAFE' }}>
                      <StudentTenses studentId={s.id} />
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}