import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStudyTimer } from '../hooks/useStudyTimer'
import ThemeTable from '../components/ThemeTable'
import VerbSheetV2 from '../components/VerbSheetV2'
import DrillBlock from '../components/DrillBlock'
import { VideoItem, ReadingItem, WritingItem, AudioTaskItem, InstructionsItem } from '../components/ContentItems'
import LadderBlock from '../components/LadderBlock'
import RapidFireBlock from '../components/RapidFireBlock'
import ImageDescribeBlock from '../components/ImageDescribeBlock'
import ProcessTellingBlock from '../components/ProcessTellingBlock'
import StoryTellingBlock from '../components/StoryTellingBlock'

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
  const [allHomeworks, setAllHomeworks] = useState([])
  const [content, setContent] = useState([])
  const [cycleNumber, setCycleNumber] = useState(1)
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
        .select('current_homework_id, cycle_number')
        .eq('id', 1)
        .maybeSingle()

      if (!cycleRes.data) { setLoading(false); return }
      const hwId = cycleRes.data.current_homework_id

      const hwRes = await supabase
        .from('homeworks')
        .select('*')
        .eq('id', hwId)
        .maybeSingle()

      const allRes = await supabase.from('homeworks').select('*').order('id')

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
      setAllHomeworks(allRes.data || [])
      setContent(contentRes.data || [])
      setCycleNumber(cycleRes.data.cycle_number || 1)
      setWeekendUnlocked(unlocked)
      setLoading(false)
    }
    load()
  }, [profile])

  if (loading) return <div className="card">Loading homework...</div>
  if (!homework) return <div className="card">No homework assigned this week yet.</div>

  const isWeekend = day === 'weekend'
  const dayContent = content.filter(function (c) { return c.day === day })

  const blockNums = []
  dayContent.forEach(function (c) {
    if (blockNums.indexOf(c.block) === -1) blockNums.push(c.block)
  })
  blockNums.sort(function (a, b) { return a - b })

  const blocks = blockNums.map(function (n) {
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
            Homework target: 3h — {Math.min(100, Math.round(timer.seconds / 108))}%
          </div>
          <div className="timer-progress">
            <div
              className="timer-progress-fill"
              style={{ width: Math.min(100, timer.seconds / 108) + '%' }}
            />
          </div>
        </div>
      </div>

      <ThemeTable homeworks={allHomeworks} currentId={homework.id} />

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
              {d.label}{locked ? ' (locked)' : ''}
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
          const visibleItems = block.items.filter(function (item) {
            const lvl = Number(profile.level)
            const minL = item.min_level != null ? Number(item.min_level) : 0
            const maxL = item.max_level != null ? Number(item.max_level) : 99
            if (lvl < minL || lvl > maxL) return false
            if (
              profile.track === 'oral_only' &&
              (item.skill_tag === 'reading' || item.skill_tag === 'writing')
            ) return false
            return true
          })
          if (visibleItems.length === 0) return null

          const hasRapidFire = visibleItems.some(function (item) {
            return item.item_type === 'rapid_fire'
          })

          if (hasRapidFire) {
            return (
              <RapidFireBlock
                key={block.num}
                item={visibleItems[0]}
                user={profile}
                homeworkId={homework.id}
                day={day}
                cycleNumber={cycleNumber}
              />
            )
          }

          const hasImageDescribe = visibleItems.some(function (item) {
            return item.item_type === 'image_describe'
          })

          if (hasImageDescribe) {
            return (
              <ImageDescribeBlock
                key={block.num}
                item={visibleItems[0]}
                user={profile}
                homeworkId={homework.id}
                day={day}
                cycleNumber={cycleNumber}
              />
            )
          }

          const processItem = visibleItems.find(function (item) {
            return item.item_type === 'process_telling'
          })

          if (processItem) {
            return (
              <div key={block.num}>
                {visibleItems
                  .filter(function (item) { return item.item_type === 'instructions' })
                  .map(function (item) {
                    return <InstructionsItem key={item.id} item={item} />
                  })}
                <ProcessTellingBlock
                  item={processItem}
                  user={profile}
                  homeworkId={homework.id}
                  day={day}
                  cycleNumber={cycleNumber}
                />
              </div>
            )
          }

          const storyItem = visibleItems.find(function (item) {
            return item.item_type === 'story_telling'
          })

          if (storyItem) {
            return (
              <div key={block.num}>
                {visibleItems
                  .filter(function (item) { return item.item_type === 'instructions' })
                  .map(function (item) {
                    return <InstructionsItem key={item.id} item={item} />
                  })}
                <StoryTellingBlock
                  item={storyItem}
                  user={profile}
                  homeworkId={homework.id}
                  day={day}
                  cycleNumber={cycleNumber}
                />
              </div>
            )
          }

          const hasVerbSheet = visibleItems.some(function (item) {
            return item.item_type === 'verb_sheet'
          })
          const hasSolve = visibleItems.some(function (item) {
            return item.item_type === 'solve'
          })
          const onlySolveAndInfo = visibleItems.every(function (item) {
            return item.item_type === 'solve' || item.item_type === 'instructions'
          })
          const isDrill = hasSolve && onlySolveAndInfo
          const isLadder = visibleItems.some(function (item) {
            return item.extra && item.extra.mode === 'one_by_one'
          })

          return (
            <div className="card block-card" key={block.num}>
              <div className="block-title">
                <span className="block-num">{block.num}</span>
                {(function () {
                  const titled = block.items.find(function (i) { return i.block_title })
                  if (titled) return titled.block_title
                  return hasVerbSheet ? 'Verb test' : 'Block ' + block.num
                })()}
              </div>
              {isLadder ? (
                <LadderBlock
                  items={visibleItems}
                  profile={profile}
                />
              ) : isDrill ? (
                <DrillBlock
                  items={visibleItems}
                  profile={profile}
                  homeworkId={homework.id}
                  day={day}
                  block={block.num}
                />
              ) : (
                visibleItems.map(function (item) {
                  if (item.item_type === 'verb_sheet') {
                    return (
                      <VerbSheetV2
                        key={item.id}
                        item={item}
                        profile={profile}
                        homeworkId={homework.id}
                        cycleNumber={cycleNumber}
                      />
                    )
                  }
                  if (item.item_type === 'video') {
                    return <VideoItem key={item.id} item={item} />
                  }
                  if (item.item_type === 'reading') {
                    return <ReadingItem key={item.id} item={item} />
                  }
                  if (item.item_type === 'writing') {
                    return <WritingItem key={item.id} item={item} profile={profile} />
                  }
                  if (item.item_type === 'audio_task') {
                    return <AudioTaskItem key={item.id} item={item} />
                  }
                  if (item.item_type === 'instructions') {
                    return <InstructionsItem key={item.id} item={item} />
                  }
                  return <SolveRow key={item.id} prompt={item.prompt} correction={item.correction} />
                })
              )}
            </div>
          )
        })
      )}
    </div>
  )
}