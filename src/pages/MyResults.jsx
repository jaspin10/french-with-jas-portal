import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { aggregateAttempts, TenseMasteryList } from './MyTenses'

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

export default function MyResults(props) {
  const profile = props.profile
  const [evals, setEvals] = useState([])
  const [themes, setThemes] = useState({})
  const [inProgress, setInProgress] = useState(null)
  const [tenseRows, setTenseRows] = useState([])
  const [drills, setDrills] = useState([])
  const [rfResults, setRfResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(function () {
    let alive = true
    async function load() {
      const evRes = await supabase
        .from('monday_evaluations')
        .select('*')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false })

      const hwRes = await supabase.from('homeworks').select('id, theme')
      const themeMap = {}
      ;(hwRes.data || []).forEach(function (h) { themeMap[h.id] = h.theme })

      const cyc = await supabase.from('global_cycle').select('*').eq('id', 1).maybeSingle()
      let progress = null
      if (cyc.data) {
        const hwId = cyc.data.current_homework_id
        const cn = cyc.data.cycle_number || 1
        const hasEval = (evRes.data || []).some(function (ev) {
          return ev.homework_id === hwId && ev.cycle_number === cn
        })
        if (!hasEval) progress = { hwId: hwId }
      }

      // Tense mastery (was My Tenses)
      const vRes = await supabase
        .from('verb_attempts')
        .select('tense, correct_count, total')
        .eq('student_id', profile.id)

      // Block 2 drill scores (auto-scored, not AI-graded)
      const dRes = await supabase
        .from('drill_attempts')
        .select('homework_id, day, block, correct_count, total')
        .eq('student_id', profile.id)

      const byHw = {}
      ;(dRes.data || []).forEach(function (r) {
        const key = r.homework_id + '_' + r.day + '_' + r.block
        if (!byHw[key]) {
          byHw[key] = { homework_id: r.homework_id, day: r.day, block: r.block, correct: 0, total: 0, sets: 0 }
        }
        byHw[key].correct += r.correct_count
        byHw[key].total += r.total
        byHw[key].sets += 1
      })
      const drillList = Object.keys(byHw).map(function (k) { return byHw[k] })
      drillList.sort(function (a, b) { return b.homework_id - a.homework_id })

      // Rapid Fire pronunciation results
      const rfRes = await supabase
        .from('rapid_fire_transcripts')
        .select('*, homework_content!inner(homework_id, block, block_title)')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false })

      if (alive) {
        setEvals(evRes.data || [])
        setThemes(themeMap)
        setInProgress(progress)
        setTenseRows(aggregateAttempts(vRes.data || []))
        setDrills(drillList)
        setRfResults(rfRes.data || [])
        setLoading(false)
      }
    }
    load()
    return function () { alive = false }
  }, [profile.id])

  if (loading) return <div className="card">Loading results...</div>

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>My Results</h2>

      {inProgress && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="block-title">
            Week {inProgress.hwId} — Monday evaluation
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            In progress — finish all Monday translations to receive your evaluation and analysis.
          </div>
        </div>
      )}

      {evals.length === 0 && !inProgress && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            No evaluations yet. Complete a Monday homework to see your first result.
          </div>
        </div>
      )}

      {evals.map(function (ev) {
        const mc = ev.mistake_counts || {}
        const cats = Object.keys(mc).sort(function (a, b) { return mc[b] - mc[a] })
        let totalMistakes = 0
        cats.forEach(function (k) { totalMistakes += mc[k] })
        return (
          <div className="card" key={ev.id} style={{ marginBottom: 16 }}>
            <div className="block-title" style={{ justifyContent: 'space-between' }}>
              <span>
                Week {ev.homework_id} — Monday evaluation
                {ev.cycle_number > 1 ? ' (cycle ' + ev.cycle_number + ')' : ''}
              </span>
              {ev.score != null && (
                <span style={{
                  fontSize: 15, fontWeight: 800,
                  color: ev.score >= 80 ? '#157A3D' : ev.score >= 50 ? 'var(--amber)' : 'var(--red)'
                }}>
                  {ev.score} / 100
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
              {themes[ev.homework_id] || ''} · {new Date(ev.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              {' · '}{totalMistakes} mistake{totalMistakes === 1 ? '' : 's'}
            </div>
            {cats.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {cats.map(function (k) {
                  return (
                    <span key={k} style={{
                      fontSize: 12, fontWeight: 600, padding: '3px 10px',
                      borderRadius: 999, background: '#FDEBEC', color: 'var(--red)'
                    }}>
                      {(MISTAKE_LABELS[k] || k) + ' x' + mc[k]}
                    </span>
                  )
                })}
              </div>
            )}
            {ev.analysis && (
              <div style={{
                background: 'var(--primary-soft)', borderRadius: 10,
                padding: '12px 16px', fontSize: 14, whiteSpace: 'pre-line'
              }}>
                {ev.analysis}
              </div>
            )}
          </div>
        )
      })}

      {drills.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '8px 0 12px' }}>Translation drills</h3>
          {drills.map(function (d) {
            const pct = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0
            const col = pct >= 80 ? '#157A3D' : pct >= 50 ? 'var(--amber)' : 'var(--red)'
            return (
              <div className="card" key={d.homework_id + '_' + d.day + '_' + d.block} style={{ marginBottom: 12 }}>
                <div className="block-title" style={{ justifyContent: 'space-between' }}>
                  <span>
                    Week {d.homework_id} — {d.day.charAt(0).toUpperCase() + d.day.slice(1)} drill (Block {d.block})
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: col }}>
                    {pct}%
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {themes[d.homework_id] || ''} · {d.correct}/{d.total} correct · {d.sets} set{d.sets === 1 ? '' : 's'} submitted
                </div>
              </div>
            )
          })}
        </div>
      )}

      {rfResults.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '8px 0 12px' }}>Rapid Fire pronunciation</h3>
          {rfResults.map(function (r) {
            const hc = r.homework_content || {}
            const pct = r.max_score > 0 ? (r.score / r.max_score) * 100 : 0
            const col = pct >= 80 ? '#157A3D' : pct >= 50 ? 'var(--amber)' : 'var(--red)'
            const mistakes = r.mistakes || []
            const isDebate = r.max_score === 20
            return (
              <div className="card" key={r.id} style={{ marginBottom: 12 }}>
                <div className="block-title" style={{ justifyContent: 'space-between' }}>
                  <span>
                    Week {hc.homework_id} — {hc.block_title || 'Rapid Fire (Block ' + hc.block + ')'}
                    {r.cycle_number > 1 ? ' (cycle ' + r.cycle_number + ')' : ''}
                  </span>
                  {r.score != null && (
                    <span style={{ fontSize: 15, fontWeight: 800, color: col }}>
                      {r.score} / {r.max_score}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
                  {themes[hc.homework_id] || ''} · {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' · '}{mistakes.length} mistake{mistakes.length === 1 ? '' : 's'}
                </div>
                {mistakes.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {mistakes.map(function (m, i) {
                      return (
                        <span key={i} style={{
                          fontSize: 12, fontWeight: 600, padding: '3px 10px',
                          borderRadius: 999, background: '#FDEBEC', color: 'var(--red)'
                        }}>
                          {isDebate
                            ? (m.expected || '') + (m.heard ? ' — heard: ' + m.heard : '')
                            : 'Sentence ' + m.n + (m.issue ? ': ' + m.issue : '')}
                        </span>
                      )
                    })}
                  </div>
                )}
                {r.ai_note && (
                  <div style={{
                    background: 'var(--primary-soft)', borderRadius: 10,
                    padding: '12px 16px', fontSize: 14, marginBottom: 8
                  }}>
                    {r.ai_note}
                  </div>
                )}
                {r.transcript && (
                  <details className="rf-transcript">
                    <summary>What the AI heard</summary>
                    <p>{r.transcript}</p>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      )}

      <h3 style={{ margin: '8px 0 12px' }}>Tense mastery</h3>
      <TenseMasteryList rows={tenseRows} />
    </div>
  )
}