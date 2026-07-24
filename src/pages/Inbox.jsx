import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Inbox() {
  const [subs, setSubs] = useState([])
  const [students, setStudents] = useState([])
  const [filter, setFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [draftGrade, setDraftGrade] = useState('')
  const [draftFeedback, setDraftFeedback] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    const sRes = await supabase
      .from('submissions').select('*').order('submitted_at', { ascending: false })
    const pRes = await supabase
      .from('profiles').select('id, full_name, avatar_url, level').eq('role', 'student')
    setSubs(sRes.data || [])
    setStudents(pRes.data || [])
    setLoading(false)
  }

  useEffect(function () { load() }, [])

  function studentOf(sub) {
    return students.find(function (s) { return s.id === sub.student_id }) || {}
  }

  async function openFile(sub) {
    const res = await supabase.storage
      .from('submissions')
      .createSignedUrl(sub.storage_path, 300)
    if (res.data) window.open(res.data.signedUrl, '_blank')
  }

  async function deleteSubmission(sub) {
    const ok = window.confirm(
      'Delete this submission from ' + (studentOf(sub).full_name || 'this student') +
      '? This cannot be undone.'
    )
    if (!ok) return
    await supabase.storage.from('submissions').remove([sub.storage_path])
    const res = await supabase.from('submissions').delete().eq('id', sub.id)
    if (res.error) {
      alert('Could not delete: ' + res.error.message)
      return
    }
    load()
  }


  function startGrading(sub) {
    setEditingId(sub.id)
    setDraftGrade(sub.grade != null ? String(sub.grade) : '')
    setDraftFeedback(sub.feedback || '')
  }

  async function saveGrading(sub) {
    const gradeValue = draftGrade === '' ? null : Number(draftGrade)
    if (gradeValue != null && (isNaN(gradeValue) || gradeValue < 0 || gradeValue > 100)) {
      alert('Grade must be a number between 0 and 100.')
      return
    }
    await supabase
      .from('submissions')
      .update({
        grade: gradeValue,
        feedback: draftFeedback || null,
        feedback_at: new Date().toISOString()
      })
      .eq('id', sub.id)
    setEditingId(null)
    load()
  }

  if (loading) return <div className="card">Loading inbox...</div>

  const filtered = subs.filter(function (s) {
    if (filter === 'ungraded') return s.grade == null && !s.feedback
    if (filter === 'late') return s.is_late
    return true
  })

  const ungradedCount = subs.filter(function (s) {
    return s.grade == null && !s.feedback
  }).length

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Submissions Inbox</h2>

      <div className="cl-stats">
        <div className="card cl-stat">
          <div className="stat-value">{subs.length}</div>
          <div className="stat-label">Total submissions</div>
        </div>
        <div className="card cl-stat">
          <div className="stat-value" style={ungradedCount > 0 ? { color: 'var(--amber)' } : {}}>
            {ungradedCount}
          </div>
          <div className="stat-label">Awaiting feedback</div>
        </div>
      </div>

      <div className="sub-actions">
        {['all', 'ungraded', 'late'].map(function (f) {
          return (
            <button
              key={f}
              className={'day-tab' + (filter === f ? ' active' : '')}
              onClick={function () { setFilter(f) }}
            >
              {f === 'all' ? 'All' : f === 'ungraded' ? 'Awaiting feedback' : 'Late only'}
            </button>
            
          )
        })}
      </div>

      <div className="card">
        {filtered.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: 12 }}>
            Nothing here.
          </div>
        )}
        {filtered.map(function (sub) {
          const st = studentOf(sub)
          return (
            <div key={sub.id} style={{ padding: '16px 0', borderBottom: '1px solid #F0F1F6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {st.avatar_url ? (
                    <img src={st.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: '50%' }} />
                  ) : (
                    <div className="avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                      {(st.full_name || '?').charAt(0)}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 700 }}>{st.full_name || 'Unknown'}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      HW {sub.homework_id} · {sub.kind} · {new Date(sub.submitted_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={'pill ' + (sub.is_late ? 'late' : 'ontime')}>
                    {sub.is_late ? 'LATE' : 'ON TIME'}
                  </span>
                  {sub.grade != null && (
                    <span className="pill ontime">{sub.grade}/100</span>
                  )}
                  <button className="reveal-btn" onClick={function () { openFile(sub) }}>
                    Open
                  </button>
                  <button className="reveal-btn" onClick={function () { startGrading(sub) }}>
                    {sub.grade != null || sub.feedback ? 'Edit feedback' : 'Grade'}
                  </button>
                  <button
                    className="reveal-btn"
                    style={{ background: 'var(--red-soft)', color: 'var(--red)' }}
                    onClick={function () { deleteSubmission(sub) }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {sub.feedback && editingId !== sub.id && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 13 }}>
                  {sub.feedback}
                </div>
              )}

              {editingId === sub.id && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <input
                      className="solve-input"
                      style={{ width: 110, minHeight: 0 }}
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Grade /100"
                      value={draftGrade}
                      onChange={function (e) { setDraftGrade(e.target.value) }}
                    />
                    <textarea
                      className="solve-input"
                      style={{ flex: 1, minWidth: 240 }}
                      placeholder="Improvement feedback for the student..."
                      value={draftFeedback}
                      onChange={function (e) { setDraftFeedback(e.target.value) }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="sub-btn" onClick={function () { saveGrading(sub) }}>
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
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

