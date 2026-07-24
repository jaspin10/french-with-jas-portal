import { useState } from 'react'

const PRONOUNS = ['je', 'tu', 'il/elle', 'nous', 'vous', 'ils/elles']

export default function VerbSheet(props) {
  // props.verb = infinitive, props.data = { "Présent": ["vais","vas",...], ... }
  const data = props.data || {}
  const tenses = Object.keys(data)
  const [openTense, setOpenTense] = useState(null)
  const [answers, setAnswers] = useState({})
  const [revealed, setRevealed] = useState({})

  function setAnswer(tense, index, value) {
    const key = tense + '-' + index
    const next = {}
    Object.keys(answers).forEach(function (k) { next[k] = answers[k] })
    next[key] = value
    setAnswers(next)
  }

  function reveal(tense) {
    const next = {}
    Object.keys(revealed).forEach(function (k) { next[k] = revealed[k] })
    next[tense] = true
    setRevealed(next)
  }

  function cellStatus(tense, index) {
    if (!revealed[tense]) return null
    const typed = (answers[tense + '-' + index] || '').trim().toLowerCase()
    const correct = (data[tense][index] || '').trim().toLowerCase()
    if (typed === '') return null
    return typed === correct ? 'good' : 'bad'
  }

  return (
    <div className="verb-sheet">
      <div className="verb-title">{props.verb}</div>
      <div className="verb-tenses">
        {tenses.map(function (tense) {
          const isOpen = openTense === tense
          return (
            <div key={tense} className="verb-tense-block">
              <button
                className={'day-tab' + (isOpen ? ' active' : '')}
                style={{ fontSize: 13, padding: '8px 14px' }}
                onClick={function () { setOpenTense(isOpen ? null : tense) }}
              >
                {tense}
              </button>
              {isOpen && (
                <div style={{ marginTop: 10 }}>
                  {PRONOUNS.map(function (p, i) {
                    const status = cellStatus(tense, i)
                    return (
                      <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ width: 70, fontSize: 13, color: 'var(--text-muted)' }}>{p}</span>
                        <input
                          className="solve-input"
                          style={{
                            minHeight: 0, padding: '8px 12px', flex: 1,
                            borderColor: status === 'good' ? 'var(--green)' : status === 'bad' ? 'var(--red)' : undefined
                          }}
                          value={answers[tense + '-' + i] || ''}
                          onChange={function (e) { setAnswer(tense, i, e.target.value) }}
                        />
                        {revealed[tense] && (
                          <span style={{
                            fontSize: 13, minWidth: 90,
                            color: status === 'good' ? '#157A3D' : 'var(--primary)',
                            fontWeight: 600
                          }}>
                            {data[tense][i]}
                          </span>
                        )}
                      </div>
                    )
                  })}
                  {!revealed[tense] && (
                    <button className="reveal-btn" onClick={function () { reveal(tense) }}>
                      Reveal corrections
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}