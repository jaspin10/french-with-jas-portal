import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { InstructionsItem } from './ContentItems'

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, ' ')
}

export default function LadderBlock(props) {
  const items = props.items
  const profile = props.profile

  const [drafts, setDrafts] = useState({})
  const [attempts, setAttempts] = useState({})
  const [loading, setLoading] = useState(true)

  const solveItems = items.filter(function (i) { return i.item_type === 'solve' })
  const infoItems = items.filter(function (i) { return i.item_type === 'instructions' })

  useEffect(function () {
    const ids = solveItems.map(function (i) { return i.id })
    if (ids.length === 0) { setLoading(false); return }
    supabase
      .from('item_attempts')
      .select('*')
      .eq('student_id', profile.id)
      .in('content_id', ids)
      .then(function (res) {
        const map = {}
        ;(res.data || []).forEach(function (a) { map[a.content_id] = a })
        setAttempts(map)
        setLoading(false)
      })
  }, [profile.id])

  function setDraft(id, value) {
    const next = {}
    Object.keys(drafts).forEach(function (k) { next[k] = drafts[k] })
    next[id] = value
    setDrafts(next)
  }

  async function submitItem(item) {
    const answer = (drafts[item.id] || '').trim()
    if (!answer) {
      alert('Write your answer first.')
      return
    }
    const correct = normalize(answer) === normalize(item.correction)
    const res = await supabase
      .from('item_attempts')
      .insert({
        student_id: profile.id,
        content_id: item.id,
        answer: answer,
        is_correct: correct
      })
      .select()
      .maybeSingle()
    if (res.error) {
      alert('Could not submit: ' + res.error.message)
      return
    }
    const next = {}
    Object.keys(attempts).forEach(function (k) { next[k] = attempts[k] })
    next[item.id] = res.data
    setAttempts(next)
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>

  const doneCount = solveItems.filter(function (i) { return attempts[i.id] }).length
  const correctCount = solveItems.filter(function (i) {
    return attempts[i.id] && attempts[i.id].is_correct
  }).length

  return (
    <div>
      {infoItems.map(function (i) {
        return <InstructionsItem key={i.id} item={i} />
      })}

      <div style={{
        marginBottom: 14, padding: '10px 16px', borderRadius: 10,
        background: 'var(--primary-soft)', color: 'var(--primary)',
        fontWeight: 700, fontSize: 14
      }}>
        Progress: {doneCount} / {solveItems.length} — Correct: {correctCount}
      </div>

      {solveItems.map(function (item, idx) {
        const attempt = attempts[item.id]
        const done = attempt != null
        const isLong = (item.prompt || '').length > 200
        return (
          <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid #F0F1F6' }}>
            <div style={{ fontSize: 14, marginBottom: 8, whiteSpace: 'pre-line' }}>
              <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{idx + 1}.</span>
              {item.prompt.replace('Traduis : ', '')}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <textarea
                className="solve-input"
                style={{
                  flex: '1 1 300px',
                  minHeight: isLong ? 160 : 40,
                  padding: '8px 12px',
                  borderColor: done ? (attempt.is_correct ? 'var(--green)' : 'var(--red)') : undefined,
                  background: done ? '#fff' : undefined
                }}
                value={done ? attempt.answer : (drafts[item.id] || '')}
                disabled={done}
                onChange={function (e) { setDraft(item.id, e.target.value) }}
              />
              {!done && (
                <button className="reveal-btn" style={{ marginTop: 0 }} onClick={function () { submitItem(item) }}>
                  Submit
                </button>
              )}
            </div>
            {done && (
              <div style={{
                marginTop: 8, fontSize: 13.5, fontWeight: 600, whiteSpace: 'pre-line',
                color: attempt.is_correct ? '#157A3D' : 'var(--primary)'
              }}>
                {item.correction}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}