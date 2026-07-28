import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { InstructionsItem } from './ContentItems'

const SET_SIZE = 10

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
  const [attempts, setAttempts] = useState({})
  const [savingSet, setSavingSet] = useState(null)
  const [loading, setLoading] = useState(true)

  const solveItems = items.filter(function (i) { return i.item_type === 'solve' })
  const infoItems = items.filter(function (i) { return i.item_type === 'instructions' })

  const sets = []
  for (let s = 0; s < solveItems.length; s += SET_SIZE) {
    sets.push(solveItems.slice(s, s + SET_SIZE))
  }

  useEffect(function () {
    supabase
      .from('drill_attempts')
      .select('*')
      .eq('student_id', profile.id)
      .eq('homework_id', homeworkId)
      .eq('day', day)
      .eq('block', block)
      .then(function (res) {
        const byId = {}
        const savedAnswers = {}
        if (res.data) {
          res.data.forEach(function (row) {
            byId[row.set_no] = row
            const a = row.answers || {}
            Object.keys(a).forEach(function (k) { savedAnswers[k] = a[k] })
          })
        }
        setAttempts(byId)
        setAnswers(savedAnswers)
        setLoading(false)
      })
  }, [profile.id, homeworkId, day, block])

  function setAnswer(id, value) {
    const next = {}
    Object.keys(answers).forEach(function (k) { next[k] = answers[k] })
    next[id] = value
    setAnswers(next)
  }

  async function submitSet(setNo) {
    const setItems = sets[setNo - 1]
    const empty = setItems.filter(function (i) {
      return !(answers[i.id] || '').trim()
    }).length
    if (empty > 0) {
      const ok = window.confirm(
        empty + ' answers in this set are still empty. Submit anyway? You cannot change answers after submitting.'
      )
      if (!ok) return
    } else {
      const ok = window.confirm('Submit this set of ' + setItems.length + '? You cannot change these answers after.')
      if (!ok) return
    }
    setSavingSet(setNo)
    let correct = 0
    const setAnswersJson = {}
    setItems.forEach(function (i) {
      setAnswersJson[i.id] = answers[i.id] || ''
      if (normalize(answers[i.id]) === normalize(i.correction)) correct += 1
    })
    const res = await supabase
      .from('drill_attempts')
      .insert({
        student_id: profile.id,
        homework_id: homeworkId,
        day: day,
        block: block,
        set_no: setNo,
        correct_count: correct,
        total: setItems.length,
        answers: setAnswersJson
      })
      .select()
      .maybeSingle()
    setSavingSet(null)
    if (res.error) {
      alert('Could not submit: ' + res.error.message)
      return
    }
    const next = {}
    Object.keys(attempts).forEach(function (k) { next[k] = attempts[k] })
    next[setNo] = res.data
    setAttempts(next)
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>

  const doneSets = Object.keys(attempts).length
  let totalCorrect = 0
  let totalDone = 0
  Object.keys(attempts).forEach(function (k) {
    totalCorrect += attempts[k].correct_count
    totalDone += attempts[k].total
  })

  return (
    <div>
      {infoItems.map(function (i) {
        return <InstructionsItem key={i.id} item={i} />
      })}

      <div style={{
        marginBottom: 14, padding: '10px 16px', borderRadius: 10,
        background: 'var(--primary-soft)', color: 'var(--primary)',
        fontWeight: 700, fontSize: 15
      }}>
        {doneSets === 0
          ? 'Sets of ' + SET_SIZE + ' — submit each set when ready'
          : 'Score so far: ' + totalCorrect + ' / ' + totalDone +
            ' (' + Math.round(totalCorrect / totalDone * 100) + '%) — ' +
            (sets.length - doneSets) + ' of ' + sets.length + ' sets remaining'}
      </div>

      {sets.map(function (setItems, sIdx) {
        const setNo = sIdx + 1
        const attempt = attempts[setNo]
        const done = attempt != null
        return (
          <div key={setNo} style={{ marginBottom: 18 }}>
            <div style={{
              fontWeight: 700, fontSize: 13.5, color: 'var(--text-muted)',
              margin: '10px 0 4px'
            }}>
              Set {setNo} — questions {sIdx * SET_SIZE + 1} to {sIdx * SET_SIZE + setItems.length}
              {done ? ' — ' + attempt.correct_count + ' / ' + attempt.total + ' locked' : ''}
            </div>

            {setItems.map(function (item, idx) {
              const globalIdx = sIdx * SET_SIZE + idx
              const savedAnswer = done ? (attempt.answers ? attempt.answers[item.id] : '') : answers[item.id]
              const correct = done ? normalize(savedAnswer) === normalize(item.correction) : false
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 0', borderBottom: '1px solid #F0F1F6',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ flex: '0 1 auto', minWidth: 200, fontSize: 14 }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{globalIdx + 1}.</span>
                    {item.prompt.replace('Traduis : ', '')}
                  </div>
                  <input
                    className="solve-input"
                    style={{
                      flex: '0 1 260px', minHeight: 0, padding: '7px 12px',
                      borderColor: done ? (correct ? 'var(--green)' : 'var(--red)') : undefined,
                      background: done ? '#fff' : undefined
                    }}
                    value={savedAnswer || ''}
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
              <button
                className="sub-btn"
                style={{ marginTop: 10 }}
                onClick={function () { submitSet(setNo) }}
                disabled={savingSet != null}
              >
                {savingSet === setNo ? 'Submitting...' : 'Submit set ' + setNo}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}