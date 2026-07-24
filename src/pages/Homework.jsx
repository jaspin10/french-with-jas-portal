import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStudyTimer } from '../hooks/useStudyTimer'

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'weekend', label: 'Week-end' },
]

function SolveRow(props) {
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="solve-row">
      <div className="solve-prompt">{props.prompt}</div>
      <textarea
        className="solve-input"
        placeholder="Type your answer in French..."
        value={answer}
        onChange={function (e) { setAnswer(e.target.value) }}
      />
      {!revealed ? (
        <button className="reveal-btn" onClick={function () { setRevealed(true) }}>
          Reveal correction
        </button>
      ) : (
        <div className="correction">{props.correction}</div>
      )}
    </div>
  )
}

export default function Homework(props) {
  const profile = props.profile
  const [homework, setHomework] = useState(null)
  const [content, setContent] = useState([])
  const [day, setDay] = useState('monday')
  const [loading, setLoading] = useState(true)
  const [weekendUnlocked, setWeekendUnlocked] = useState(false)
  const timer = useStudyTimer(
    profile ? profile.id : null,
    homework ? homework.id : null
  )

  function fmt(total) {
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    return (
      (h > 0 ? h + 'h ' : '') +
      String(m).padStart(2, '0') + 'm ' +
      String(s).padStart(2, '0') + 's'
    )
  }

  useEffect(function () {
    async function load() {
      const cycleRes = await supabase
        .from('global_cycle')
        .select('current_homework_id')
        .eq('id', 1)
        .maybeSingle()

      if (!cycleRes.data) { setLoading(false); return }
      const hwId = cycleRes.data.current_homework_id

      const hwRes = await supabase
        .from('homeworks')
        .select('*')
        .eq('id', hwId)
        .maybeSingle()

      const contentRes = await supabase
        .from('homework_content')
        .select('*')
        .eq('homework_id', hwId)
        .order('day')
        .order('block')
        .order('position')

      let unlocked = profile && Number(profile.level) >= 4
      if (!unlocked && profile) {
        const ovRes = await supabase
          .from('overrides')
          .select('id')
          .eq('student_id', profile.id)
          .eq('what', 'weekend_tab')
          .maybeSingle()
        if (ovRes.data) unlocked = true
      }

      setHomework(hwRes.data)
      setContent(contentRes.data || [])
      setWeekendUnlocked(unlocked)
      setLoading(false)
    }
    load()
  }, [profile])

  if (loading) return <div className="card">Loading homework...</div>
  if (!homework) return <div className="card">No homework assigned this week yet.</div>

  const isWeekend = day === 'weekend'
  const dayContent = content.filter(function (c) { return c.day === day })
  const blocks = [1, 2, 3].map(function (n) {
    return {
      num: n,
      items: dayContent.filter(function (c) { return c.block === n })
    }
  })

  return (
    <div>
      <div className="hw-header">
        <div className="hw-theme">Week — {homework.theme}</div>
        <div className="hw-meta">
          {homework.tense ? homework.tense + ' · ' : ''}{homework.skill}
        </div>
        {homework.custom_message && (
          <div className="hw-message">{homework.custom_message}</div>
        )}
      </div>

      <div className="timer-bar">
        <div>
          <span className="timer-time">{fmt(timer.seconds)}</span>
          <span className={'timer-state ' + (timer.active ? 'on' : 'off')}>
            {timer.active ? '● tracking' : '❚❚ paused (inactive)'}
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="timer-target">
            Homework target: 3h — {Math.min(100, Math.round(timer.seconds / 108)) }%
          </div>
          <div className="timer-progress">
            <div
              className="timer-progress-fill"
              style={{ width: Math.min(100, timer.seconds / 108) + '%' }}
            />
          </div>
        </div>
      </div>

      <div className="day-tabs">
        {DAYS.map(function (d) {
          const locked = d.key === 'weekend' && !weekendUnlocked
          return (
            <button
              key={d.key}
              className={
                'day-tab' +
                (day === d.key ? ' active' : '') +
                (locked ? ' locked' : '')
              }
              onClick={function () { if (!locked) setDay(d.key) }}
            >
              {d.label}{locked ? ' 🔒' : ''}
            </button>
          )
        })}
      </div>

      {isWeekend && !weekendUnlocked ? (
        <div className="card locked-panel">
          <h3 style={{ marginBottom: 8 }}>TCF Tasks</h3>
          Unlocks at Level 4.
        </div>
      ) : dayContent.length === 0 ? (
        <div className="card locked-panel">
          Content for this day is coming soon.
        </div>
      ) : (
        blocks.map(function (block) {
          if (block.items.length === 0) return null
          return (
            <div className="card block-card" key={block.num}>
              <div className="block-title">
                <span className="block-num">{block.num}</span>
                Block {block.num}
              </div>
              {block.items.map(function (item) {
                return (
                  <SolveRow
                    key={item.id}
                    prompt={item.prompt}
                    correction={item.correction}
                  />
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}