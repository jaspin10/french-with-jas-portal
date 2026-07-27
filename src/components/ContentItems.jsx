import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function VideoItem(props) {
  const extra = props.item.extra || {}
  return (
    <div className="solve-row">
      {props.item.prompt && <div className="solve-prompt">{props.item.prompt}</div>}
      {extra.youtube_id && (
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 12, overflow: 'hidden' }}>
          <iframe
            src={'https://www.youtube.com/embed/' + extra.youtube_id}
            title="Listening exercise"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {extra.note && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>{extra.note}</div>
      )}
    </div>
  )
}

export function ReadingItem(props) {
  const extra = props.item.extra || {}
  const [open, setOpen] = useState(true)
  return (
    <div className="solve-row">
      {props.item.prompt && <div className="solve-prompt">{props.item.prompt}</div>}
      {open && extra.text && (
        <div style={{
          background: '#FBFBFD', border: '1px solid #E3E5EE', borderRadius: 12,
          padding: 16, fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap'
        }}>
          {extra.text}
        </div>
      )}
      {extra.text && (
        <button className="reveal-btn" onClick={function () { setOpen(!open) }}>
          {open ? 'Hide text' : 'Show text'}
        </button>
      )}
    </div>
  )
}

export function WritingItem(props) {
  const item = props.item
  const profile = props.profile
  const [text, setText] = useState('')
  const [state, setState] = useState('idle')

  async function submit() {
    if (text.trim().length < 10) {
      alert('Write a bit more before submitting.')
      return
    }
    setState('saving')
    const path = profile.id + '/' + item.homework_id + '/writing-' + item.id + '-' + Date.now() + '.txt'
    const blob = new Blob([text], { type: 'text/plain' })
    const up = await supabase.storage.from('submissions').upload(path, blob)
    if (up.error) {
      alert('Could not submit: ' + up.error.message)
      setState('idle')
      return
    }
    await supabase.from('submissions').insert({
      student_id: profile.id,
      homework_id: item.homework_id,
      day: item.day,
      kind: 'writing',
      storage_path: path,
      is_late: false
    })
    setState('done')
  }

  return (
    <div className="solve-row">
      <div className="solve-prompt">{item.prompt}</div>
      <textarea
        className="solve-input"
        style={{ minHeight: 140 }}
        placeholder="Ecris ta reponse ici..."
        value={text}
        disabled={state === 'done'}
        onChange={function (e) { setText(e.target.value) }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        {state !== 'done' ? (
          <button className="sub-btn" onClick={submit} disabled={state === 'saving'}>
            {state === 'saving' ? 'Submitting...' : 'Submit writing'}
          </button>
        ) : (
          <span className="pill ontime">SUBMITTED</span>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {text.length} characters
        </span>
      </div>
    </div>
  )
}

export function AudioTaskItem(props) {
  return (
    <div className="solve-row">
      <div className="solve-prompt">{props.item.prompt}</div>
      <div style={{
        fontSize: 13, color: 'var(--primary)', background: 'var(--primary-soft)',
        borderRadius: 10, padding: '10px 14px', display: 'inline-block'
      }}>
        Speaking task — record your answer in the Submissions tab
      </div>
    </div>
  )
}

export function InstructionsItem(props) {
  return (
    <div className="solve-row">
      <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
        {props.item.prompt}
      </div>
    </div>
  )
}