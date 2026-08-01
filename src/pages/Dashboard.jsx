import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import WeeklyProgressCard from '../components/WeeklyProgressCard'

function ymd(date) {
  return date.toISOString().slice(0, 10)
}

export default function Dashboard(props) {
  const profile = props.profile
  const [days, setDays] = useState([])
  const [examDate, setExamDate] = useState('')
  const [savingExam, setSavingExam] = useState(false)
  const [todaySeconds, setTodaySeconds] = useState(0)
  const [loading, setLoading] = useState(true)

  async function load() {
    const clRes = await supabase
      .from('checklist_days')
      .select('*')
      .eq('student_id', profile.id)
    const tRes = await supabase
      .from('time_logs')
      .select('seconds')
      .eq('student_id', profile.id)
      .eq('day', ymd(new Date()))
    let total = 0
    ;(tRes.data || []).forEach(function (r) { total += r.seconds })
    setTodaySeconds(total)
    setDays(clRes.data || [])
    setExamDate(profile.exam_date || '')
    setLoading(false)
  }

  useEffect(function () { if (profile) load() }, [profile])

  async function saveExamDate() {
    setSavingExam(true)
    await supabase
      .from('profiles')
      .update({ exam_date: examDate || null })
      .eq('id', profile.id)
    setSavingExam(false)
  }

  function getDay(dateStr) {
    return days.find(function (d) { return d.day === dateStr }) || null
  }

  async function toggle(dateStr, field) {
    const existing = getDay(dateStr)
    if (existing) {
      const update = {}
      update[field] = !existing[field]
      await supabase
        .from('checklist_days')
        .update(update)
        .eq('id', existing.id)
    } else {
      const row = { student_id: profile.id, day: dateStr }
      row[field] = true
      await supabase.from('checklist_days').insert(row)
    }
    load()
  }

  // Build the visible day list: start date (or 14 days ago) -> exam date (or +14 days)
  function buildDayList() {
    const list = []
    const today = new Date()
    let start = profile.start_date ? new Date(profile.start_date) : new Date()
    const twoWeeksAgo = new Date(today.getTime() - 14 * 86400000)
    if (start < twoWeeksAgo) start = twoWeeksAgo // show recent past only, keep it light
    let end
    if (examDate) {
      end = new Date(examDate)
    } else {
      end = new Date(today.getTime() + 14 * 86400000)
    }
    const cursor = new Date(start)
    while (cursor <= end && list.length < 120) {
      list.push(ymd(new Date(cursor)))
      cursor.setDate(cursor.getDate() + 1)
    }
    return list
  }

  if (loading) return <div className="card">Loading...</div>

  const dayList = buildDayList()
  const todayStr = ymd(new Date())
  const fourHourMetToday = todaySeconds >= 3 * 3600 // 3h homework tracked; class hour checked manually

  // Stats
  let completedDays = 0
  let streak = 0
  let streakBroken = false
  const pastDays = dayList.filter(function (d) { return d <= todayStr })
  pastDays.slice().reverse().forEach(function (d) {
    const row = getDay(d)
    const done = row && row.class_attended && row.block1_done && row.block2_done && row.block3_done
    if (done) {
      completedDays += 1
      if (!streakBroken) streak += 1
    } else {
      if (d !== todayStr) streakBroken = true
    }
  })
  const pct = pastDays.length > 0 ? Math.round((completedDays / pastDays.length) * 100) : 0
  const daysToExam = examDate
    ? Math.ceil((new Date(examDate) - new Date(todayStr)) / 86400000)
    : null

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>
        Bonjour{profile.full_name ? ', ' + profile.full_name.split(' ')[0] : ''}!
      </h2>

      <div className="cl-stats">
        <div className="card cl-stat">
          <div className="stat-value">
            {daysToExam != null ? daysToExam : '—'}
          </div>
          <div className="stat-label">Days until exam</div>
        </div>
        <div className="card cl-stat">
          <div className="stat-value">
            {streak} <span className="streak-flame">🔥</span>
          </div>
          <div className="stat-label">Day streak</div>
        </div>
        <div className="card cl-stat">
          <div className="stat-value">{pct}%</div>
          <div className="stat-label">Days fully completed</div>
        </div>
        <div className="card cl-stat">
          <div className="stat-value">
            {Math.floor(todaySeconds / 3600)}h {Math.floor((todaySeconds % 3600) / 60)}m
          </div>
          <div className="stat-label">Homework time today (target 3h)</div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <WeeklyProgressCard profile={profile} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="block-title">My exam date</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date"
            className="solve-input"
            style={{ width: 180, minHeight: 0 }}
            value={examDate}
            onChange={function (e) { setExamDate(e.target.value) }}
          />
          <button className="sub-btn" onClick={saveExamDate} disabled={savingExam}>
            {savingExam ? 'Saving...' : 'Save'}
          </button>
          {!examDate && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              No exam date yet — showing the next 14 days.
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="block-title">Daily checklist</div>
        {dayList.map(function (d) {
          const row = getDay(d)
          const isToday = d === todayStr
          const isFuture = d > todayStr
          const auto4h = isToday ? fourHourMetToday : (row ? row.four_hour_met : false)
          return (
            <div className={'cl-day-row' + (isToday ? ' today' : '')} key={d}>
              <div className="cl-date">
                {isToday ? 'Today' : new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
              </div>
              <div className="cl-checks">
                {[
                  { field: 'class_attended', label: '1h class' },
                  { field: 'block1_done', label: 'Block 1' },
                  { field: 'block2_done', label: 'Block 2' },
                  { field: 'block3_done', label: 'Block 3' }
                ].map(function (c) {
                  return (
                    <label className="cl-check" key={c.field}>
                      <input
                        type="checkbox"
                        disabled={isFuture}
                        checked={row ? row[c.field] : false}
                        onChange={function () { if (!isFuture) toggle(d, c.field) }}
                      />
                      {c.label}
                    </label>
                  )
                })}
                <span className="cl-check auto">
                  <input type="checkbox" readOnly checked={auto4h} disabled />
                  3h homework (auto)
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
