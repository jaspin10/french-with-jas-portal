import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, ' ')
}

export default function DrillBlock(props) {
  const items = props.items
  const profile = props.profile
  const homeworkId = props.homeworkId
  const day = props.day
  const block = props.block

  const [answers, setAnswers] = useState({})
  const [attempt, setAttempt] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const solveItems = items.filter(function (i) { return i.item_type === 'solve' })
  const infoItems = items.filter(function (i) { return i.item_type === 'instructions' })

  useEffect(function () {
    supabase
      .from('drill_attempts')
      .select('*')
      .eq('student_id', profile.id)
      .eq('homework_id', homeworkId)
      .eq('day', day)
      .eq('block', block)
      .maybeSingle()
      .then(function (res) {
        if (res.data) {
          setAttempt(res.data)
          setAnswers(res.data.answers || {})
        }
        setLoading(false)
      })
  }, [profile.id, homeworkId, day, block])

  function setAnswer(id, value) {
    const next = {}
    Object.keys(answers).forEach(function (k) { next[k] = answers[k] })
    next[id] = value
    setAnswers(next)
  }

  function isCorrect(item) {
    return normalize(answers[item.id]) === normalize(item.correction)
  }

  async function submit() {
    const empty = solveItems.filter(function (i) {
      return !(answers[i.id] || '').trim()
    }).length
    if (empty > 0) {
      const ok = window.confirm(
        empty + ' answers are still empty. Submit anyway? You cannot change answers after submitting.'
      )
      if (!ok) return
    } else {
      const ok = window.confirm('Submit all answers? You cannot change them after.')
      if (!ok) return
    }
    setSaving(true)
    let correct = 0
    solveItems.forEach(function (i) { if (isCorrect(i)) correct += 1 })
    const res = await supabase
      .from('drill_attempts')
      .insert({
        student_id: profile.id,
        homework_id: homeworkId,
        day: day,
        block: block,
        correct_count: correct,
        total: solveItems.length,
        answers: answers
      })
      .select()
      .maybeSingle()
    setSaving(false)
    if (res.error) {
      alert('Could not submit: ' + res.error.message)
      return
    }
    setAttempt(res.data)
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>

  const done = attempt != null

  return (
    <div>
      {infoItems.map(function (i) {
        return (
          <div key={i.id} style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 14, whiteSpace: 'pre-wrap' }}>
            {i.prompt}
          </div>
        )
      })}

      {done && (
        <div style={{
          marginBottom: 14, padding: '10px 16px', borderRadius: 10,
          background: 'var(--primary-soft)', color: 'var(--primary)',
          fontWeight: 700, fontSize: 15
        }}>
          Score: {attempt.correct_count} / {attempt.total} ({Math.round(attempt.correct_count / attempt.total * 100)}%) — locked
        </div>
      )}

      {solveItems.map(function (item, idx) {
        const correct = done ? normalize(attempt.answers ? attempt.answers[item.id] : '') === normalize(item.correction) : false
        return (
          <div
            key={item.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 0', borderBottom: '1px solid #F0F1F6',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ flex: '1 1 240px', fontSize: 14 }}>
              <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{idx + 1}.</span>
              {item.prompt.replace('Traduis : ', '')}
            </div>
            <input
              className="solve-input"
              style={{
                flex: '1 1 220px', minHeight: 0, padding: '7px 12px',
                maxWidth: 320,
                borderColor: done ? (correct ? 'var(--green)' : 'var(--red)') : undefined,
                background: done ? '#fff' : undefined
              }}
              value={answers[item.id] || ''}
              disabled={done}
              onChange={function (e) { setAnswer(item.id, e.target.value) }}
            />
            {done && (
              <span style={{
                flex: '0 1 auto', fontSize: 13, fontWeight: 600,
                color: correct ? '#157A3D' : 'var(--primary)'
              }}>
                {item.correction}
              </span>
            )}
          </div>
        )
      })}

      {!done && (
        <button className="sub-btn" style={{ marginTop: 14 }} onClick={submit} disabled={saving}>
          {saving ? 'Submitting...' : 'Submit all answers'}
        </button>
      )}
    </div>
  )
}