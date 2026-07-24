import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const TENSE_LABELS = {
  present: 'Présent',
  imparfait: 'Imparfait',
  futur_simple: 'Futur simple',
  passe_compose: 'Passé composé',
  plus_que_parfait: 'Plus-que-parfait',
  futur_anterieur: 'Futur antérieur',
  conditionnel_present: 'Conditionnel présent',
  conditionnel_passe: 'Conditionnel passé',
  passe_recent: 'Passé récent',
  futur_proche: 'Futur proche',
  subjonctif_present: 'Subjonctif présent',
  subjonctif_passe: 'Subjonctif passé',
  imperatif: 'Impératif',
  gerondif: 'Gérondif',
  infinitif: 'Infinitif',
  participe: 'Participe',
}

const TENSE_ORDER = Object.keys(TENSE_LABELS)

export function masteryColor(pct) {
  if (pct >= 80) return 'green'
  if (pct >= 50) return 'amber'
  return 'red'
}

export function aggregateAttempts(rows) {
  const byTense = {}
  rows.forEach(function (r) {
    if (!byTense[r.tense]) {
      byTense[r.tense] = { correct: 0, total: 0, attempts: 0 }
    }
    byTense[r.tense].correct += r.correct_count
    byTense[r.tense].total += r.total
    byTense[r.tense].attempts += 1
  })
  return TENSE_ORDER
    .filter(function (t) { return byTense[t] })
    .map(function (t) {
      const a = byTense[t]
      const pct = a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0
      return {
        tense: t,
        label: TENSE_LABELS[t] || t,
        pct: pct,
        correct: a.correct,
        total: a.total,
        attempts: a.attempts,
        color: masteryColor(pct),
      }
    })
}

export function TenseMasteryList(props) {
  if (props.rows.length === 0) {
    return <div className="card">No verb tests submitted yet.</div>
  }
  return (
    <div className="card">
      {props.title ? <h3 className="mt-title">{props.title}</h3> : null}
      {props.rows.map(function (row) {
        return (
          <div className="mt-row" key={row.tense}>
            <span className="mt-label">{row.label}</span>
            <div className="mt-bar">
              <div
                className={'mt-bar-fill ' + row.color}
                style={{ width: row.pct + '%' }}
              />
            </div>
            <span className={'mt-pct ' + row.color}>{row.pct}%</span>
            <span className="mt-detail">
              {row.correct}/{row.total} · {row.attempts} test{row.attempts > 1 ? 's' : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function MyTenses(props) {
  const profile = props.profile
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(function () {
    async function load() {
      const res = await supabase
        .from('verb_attempts')
        .select('tense, correct_count, total')
        .eq('student_id', profile.id)
      setRows(aggregateAttempts(res.data || []))
      setLoading(false)
    }
    if (profile) load()
  }, [profile])

  if (loading) return <div className="card">Loading...</div>

  return (
    <div>
      <h2 className="page-title">My tenses</h2>
      <TenseMasteryList rows={rows} />
    </div>
  )
}