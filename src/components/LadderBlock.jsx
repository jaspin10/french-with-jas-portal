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

const MISTAKE_LABELS = {
  word_order: 'Word order',
  spelling: 'Spelling',
  accents: 'Accents',
  punctuation: 'Punctuation',
  capitalization: 'Capitalization',
  tense: 'Tense',
  conjugation: 'Conjugation',
  agreement: 'Agreement',
  article: 'Article',
  preposition: 'Preposition',
  vocabulary: 'Vocabulary',
  missing_words: 'Missing words',
  extra_words: 'Extra words',
  elision: 'Elision'
}

export default function LadderBlock(props) {
  const items = props.items
  const profile = props.profile

  const [drafts, setDrafts] = useState({})
  const [attempts, setAttempts] = useState({})
  const [grading, setGrading] = useState({})
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

  function setGradingFlag(id, value) {
    setGrading(function (prev) {
      const next = {}
      Object.keys(prev).forEach(function (k) { next[k] = prev[k] })
      next[id] = value
      return next
    })
  }

  function isParagraph(item) {
    return (item.prompt || '').length > 200
  }

  async function submitItem(item) {
    const answer = (drafts[item.id] || '').trim()
    if (!answer) {
      alert('Write your answer first.')
      return
    }

    setGradingFlag(item.id, true)

    const row = {
      student_id: profile.id,
      content_id: item.id,
      answer: answer,
      is_correct: false,
      graded_by: 'strict',
      mistakes: null,
      ai_score: null,
      ai_feedback: null
    }

    let usedAI = false
    try {
      const mode = isParagraph(item) ? 'paragraph' : 'sentence'
      const r = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: mode,
          english: item.prompt,
          model: item.correction,
          answer: answer
        })
      })
      if (r.ok) {
        const g = await r.json()
        if (mode === 'sentence' && typeof g.correct === 'boolean') {
          row.is_correct = g.correct
          row.mistakes = g.mistakes && g.mistakes.length > 0 ? g.mistakes : null
          row.ai_feedback = g.note || null
          row.graded_by = 'ai'
          usedAI = true
        } else if (mode === 'paragraph' && typeof g.score === 'number') {
          row.ai_score = Math.max(0, Math.min(100, Math.round(g.score)))
          row.is_correct = row.ai_score >= 80
          row.mistakes = g.mistakes && g.mistakes.length > 0 ? g.mistakes : null
          row.ai_feedback = (g.note || '') + (g.corrected ? '\n\nCorrection :\n' + g.corrected : '')
          row.graded_by = 'ai'
          usedAI = true
        }
      }
    } catch (err) {
      usedAI = false
    }

    if (!usedAI) {
      row.is_correct = normalize(answer) === normalize(item.correction)
    }

    const res = await supabase
      .from('item_attempts')
      .insert(row)
      .select()
      .maybeSingle()

    setGradingFlag(item.id, false)

    if (res.error) {
      alert('Could not submit: ' + res.error.message)
      return
    }
    const next = {}
    Object.keys(attempts).forEach(function (k) { next[k] = attempts[k] })
    next[item.id] = res.data
    setAttempts(next)

    if (props.onItemGraded) props.onItemGraded()
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
        const busy = grading[item.id] === true
        const para = isParagraph(item)
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
                  minHeight: para ? 160 : 40,
                  padding: '8px 12px',
                  borderColor: done ? (attempt.is_correct ? 'var(--green)' : 'var(--red)') : undefined,
                  background: done ? '#fff' : undefined
                }}
                value={done ? attempt.answer : (drafts[item.id] || '')}
                disabled={done || busy}
                onChange={function (e) { setDraft(item.id, e.target.value) }}
              />
              {!done && (
                <button
                  className="reveal-btn"
                  style={{ marginTop: 0 }}
                  disabled={busy}
                  onClick={function () { submitItem(item) }}
                >
                  {busy ? 'Checking...' : 'Submit'}
                </button>
              )}
            </div>
            {done && (
              <div style={{ marginTop: 8 }}>
                {attempt.ai_score != null && (
                  <div style={{
                    fontSize: 14, fontWeight: 700, marginBottom: 6,
                    color: attempt.is_correct ? '#157A3D' : 'var(--red)'
                  }}>
                    Score: {attempt.ai_score} / 100
                  </div>
                )}
                {attempt.mistakes && attempt.mistakes.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    {attempt.mistakes.map(function (m, mi) {
                      return (
                        <span key={mi} style={{
                          fontSize: 12, fontWeight: 600, padding: '3px 10px',
                          borderRadius: 999, background: '#FDEBEC', color: 'var(--red)'
                        }}>
                          {MISTAKE_LABELS[m] || m}
                        </span>
                      )
                    })}
                  </div>
                )}
                {attempt.ai_feedback && (
                  <div style={{
                    fontSize: 13.5, color: 'var(--text-muted)',
                    whiteSpace: 'pre-line', marginBottom: 6
                  }}>
                    {attempt.ai_feedback}
                  </div>
                )}
                <div style={{
                  fontSize: 13.5, fontWeight: 600, whiteSpace: 'pre-line',
                  color: attempt.is_correct ? '#157A3D' : 'var(--primary)'
                }}>
                  {attempt.correction != null ? attempt.correction : item.correction}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}