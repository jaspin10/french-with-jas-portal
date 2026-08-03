import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

      // Is the current week's Monday still in progress (no eval row yet)?
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

      if (alive) {
        setEvals(evRes.data || [])
        setThemes(themeMap)
        setInProgress(progress)
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
        <div className="card">
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
    </div>
  )
}