import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function MondayStatsCard(props) {
  const profile = props.profile
  const [history, setHistory] = useState([])
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(function () {
    let alive = true
    async function load() {
      const cyc = await supabase.from('global_cycle').select('*').eq('id', 1).maybeSingle()
      if (!cyc.data) { if (alive) setLoading(false); return }
      const hwId = cyc.data.current_homework_id
      const cycleNumber = cyc.data.cycle_number || 1

      // Past weeks: stored evaluations
      const evals = await supabase
        .from('monday_evaluations')
        .select('*')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: true })

      // Current week: live from Monday ladder items
      const content = await supabase
        .from('homework_content')
        .select('id, extra, item_type')
        .eq('homework_id', hwId)
        .eq('day', 'monday')
      const ladderIds = (content.data || [])
        .filter(function (c) {
          return c.item_type === 'solve' && c.extra && c.extra.mode === 'one_by_one'
        })
        .map(function (c) { return c.id })

      let cur = { hwId: hwId, cycleNumber: cycleNumber, done: 0, total: ladderIds.length, mistakes: 0 }
      if (ladderIds.length > 0) {
        const att = await supabase
          .from('item_attempts')
          .select('content_id, mistakes')
          .eq('student_id', profile.id)
          .in('content_id', ladderIds)
        cur.done = (att.data || []).length
        ;(att.data || []).forEach(function (a) {
          if (a.mistakes && a.mistakes.length) cur.mistakes += a.mistakes.length
        })
      }

      if (alive) {
        setHistory(evals.data || [])
        setCurrent(cur)
        setLoading(false)
      }
    }
    load()
    return function () { alive = false }
  }, [profile.id])

  if (loading) {
    return (
      <div className="card">
        <div className="block-title">Monday performance</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>
      </div>
    )
  }

  // Build bar data: past evals + current week live
  const bars = history.map(function (ev) {
    let count = 0
    const mc = ev.mistake_counts || {}
    Object.keys(mc).forEach(function (k) { count += mc[k] })
    return {
      label: 'W' + ev.homework_id,
      mistakes: count,
      score: ev.score,
      live: false
    }
  })
  if (current && current.total > 0) {
    const already = history.some(function (ev) {
      return ev.homework_id === current.hwId && ev.cycle_number === current.cycleNumber
    })
    if (!already) {
      bars.push({
        label: 'W' + current.hwId,
        mistakes: current.mistakes,
        score: null,
        live: true
      })
    }
  }
  const maxMistakes = bars.reduce(function (m, b) {
    return b.mistakes > m ? b.mistakes : m
  }, 1)

  const pct = current && current.total > 0
    ? Math.round((current.done / current.total) * 100)
    : 0

  return (
    <div className="card">
      <div className="block-title">Monday performance</div>

      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
        Mistakes per week (translation exercises)
      </div>
      {bars.length === 0 ? (
        <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 16 }}>
          No graded Monday work yet.
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 110, marginBottom: 16 }}>
          {bars.map(function (b, i) {
            const h = Math.max(8, Math.round((b.mistakes / maxMistakes) * 90))
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: '0 0 44px' }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{b.mistakes}</div>
                <div style={{
                  width: 26, height: h, borderRadius: 6,
                  background: b.live ? 'var(--primary-soft)' : 'var(--primary)',
                  border: b.live ? '2px dashed var(--primary)' : 'none'
                }}></div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                  {b.label}{b.live ? '*' : ''}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {bars.some(function (b) { return b.live }) && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 16 }}>
          * current week, still in progress
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
        This Monday completed
      </div>
      <div className="wp-bar">
        <div className="wp-bar-fill" style={{ width: pct + '%' }}></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{pct}%</span>
        <span style={{ color: 'var(--text-muted)' }}>
          {current ? current.done + ' / ' + current.total + ' translations done' : '—'}
        </span>
      </div>
    </div>
  )
}