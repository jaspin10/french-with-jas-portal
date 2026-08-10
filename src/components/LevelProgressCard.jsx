import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getLevelProgress, projectUnlockDate } from '../lib/levelProgress'

function formatDate(d) {
  if (!d) return null
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear()
}

export default function LevelProgressCard(props) {
  const user = props.user
  const [progress, setProgress] = useState(null)
  const [weekStartedOn, setWeekStartedOn] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(function () {
    let cancelled = false
    async function load() {
      if (!user || !user.id) { setLoading(false); return }
      const lvl = Number(user.level)
      if (lvl >= 4 || lvl < 2) { setLoading(false); return }
      const cRes = await supabase
        .from('global_cycle').select('week_started_on').eq('id', 1).maybeSingle()
      const p = await getLevelProgress(user.id, lvl)
      if (cancelled) return
      setWeekStartedOn(cRes.data ? cRes.data.week_started_on : null)
      setProgress(p)
      setLoading(false)
    }
    load()
    return function () { cancelled = true }
  }, [user])

  if (loading || !progress || progress.done) return null

  const allMet = progress.criteria.every(function (c) { return c.met })
  const eta = allMet
    ? null
    : projectUnlockDate(weekStartedOn, progress.weeksRemaining)

  return (
    <div className="card lvl-card">
      <div className="lvl-head">
        <div className="block-title" style={{ margin: 0 }}>
          Path to Level {progress.target}
        </div>
        {allMet ? (
          <span className="pill ontime">Ready — unlocks at next week advance</span>
        ) : (
          eta && (
            <span className="lvl-eta">Estimated unlock: {formatDate(eta)}</span>
          )
        )}
      </div>

      {progress.criteria.map(function (c) {
        const pct = c.targetVal > 0
          ? Math.min(100, Math.round((c.current / c.targetVal) * 100))
          : 0
        return (
          <div key={c.key} className="lvl-row">
            <div className="lvl-row-top">
              <span className="lvl-label">{c.label}</span>
              <span className={c.met ? 'lvl-val lvl-val-met' : 'lvl-val'}>
                {c.current} / {c.targetVal}{c.key === 'monday' ? ' avg' : ''}
              </span>
            </div>
            <div className="lvl-bar-track">
              <div
                className={c.met ? 'lvl-bar lvl-bar-met' : 'lvl-bar'}
                style={{ width: pct + '%' }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}