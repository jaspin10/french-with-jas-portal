import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Submissions(props) {
  const profile = props.profile
  const [subs, setSubs] = useState([])
  const [cycle, setCycle] = useState(null)
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  const fileInputRef = useRef(null)

  async function load() {
    const cRes = await supabase
      .from('global_cycle')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    setCycle(cRes.data)
    const sRes = await supabase
      .from('submissions')
      .select('*')
      .eq('student_id', profile.id)
      .order('submitted_at', { ascending: false })
    setSubs(sRes.data || [])
  }

  useEffect(function () { if (profile) load() }, [profile])

  function isLateNow() {
    if (!cycle) return false
    const started = new Date(cycle.week_started_on)
    const deadline = new Date(started.getTime() + 7 * 24 * 3600 * 1000)
    return new Date() > deadline
  }

  async function saveSubmission(blobOrFile, kind, extension) {
    setBusy(true)
    const path =
      profile.id + '/' + cycle.current_homework_id + '/' +
      Date.now() + '.' + extension

    const upRes = await supabase.storage
      .from('submissions')
      .upload(path, blobOrFile)

    if (upRes.error) {
      alert('Upload failed: ' + upRes.error.message)
      setBusy(false)
      return
    }

    await supabase.from('submissions').insert({
      student_id: profile.id,
      homework_id: cycle.current_homework_id,
      kind: kind,
      storage_path: path,
      is_late: isLateNow()
    })

    setBusy(false)
    load()
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = function (e) { chunksRef.current.push(e.data) }
      recorder.onstop = function () {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(function (t) { t.stop() })
        saveSubmission(blob, 'audio', 'webm')
      }
      mediaRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (err) {
      alert('Microphone access denied. Please allow it in your browser.')
    }
  }

  function stopRecording() {
    if (mediaRef.current) mediaRef.current.stop()
    setRecording(false)
  }

  function onFilePicked(e) {
    const file = e.target.files[0]
    if (!file) return
    const isPdf = file.type === 'application/pdf'
    const isImage = file.type.startsWith('image/')
    if (!isPdf && !isImage) {
      alert('Please upload a PDF or a photo.')
      return
    }
    const ext = isPdf ? 'pdf' : (file.type.split('/')[1] || 'jpg')
    saveSubmission(file, isPdf ? 'pdf' : 'photo', ext)
    e.target.value = ''
  }

  async function openFile(sub) {
    const res = await supabase.storage
      .from('submissions')
      .createSignedUrl(sub.storage_path, 300)
    if (res.data) window.open(res.data.signedUrl, '_blank')
  }


  async function deleteSubmission(sub) {
    const ok = window.confirm(
      'Delete this submission? This cannot be undone.'
    )
    if (!ok) return
    await supabase.storage.from('submissions').remove([sub.storage_path])
    const res = await supabase.from('submissions').delete().eq('id', sub.id)
    if (res.error) {
      alert('Could not delete: ' + res.error.message)
      return
    }
    load()
  }

  if (!profile || !cycle) return <div className="card">Loading...</div>

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Submissions</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="block-title">This week's homework</div>
        <div className="sub-actions">
          {!recording ? (
            <button className="sub-btn" onClick={startRecording} disabled={busy}>
              Record audio
            </button>
          ) : (
            <button className="sub-btn danger" onClick={stopRecording}>
              Stop and submit
            </button>
          )}
          <button
            className="sub-btn secondary"
            disabled={busy}
            onClick={function () { fileInputRef.current.click() }}
          >
            Upload PDF or photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            style={{ display: 'none' }}
            onChange={onFilePicked}
          />
        </div>
        {recording && (
          <div style={{ color: 'var(--red)', fontWeight: 600, fontSize: 14 }}>
            ● Recording... speak now
          </div>
        )}
        {busy && (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Uploading...</div>
        )}
      </div>

      <div className="card">
        <div className="block-title">My submissions</div>
        {subs.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Nothing submitted yet.
          </div>
        )}
        {subs.map(function (s) {
          return (
            <div className="sub-item" key={s.id}>
              <div>
                <strong>HW {s.homework_id}</strong> · {s.kind} ·{' '}
                {new Date(s.submitted_at).toLocaleString()}
                {s.feedback && (
                  <div style={{
                    marginTop: 6, padding: '8px 12px', borderRadius: 8,
                    background: 'var(--primary-soft)', color: 'var(--primary)',
                    fontSize: 13
                  }}>
                    Feedback: {s.feedback}
                    {s.grade != null && <strong> · Grade: {s.grade}</strong>}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={'pill ' + (s.is_late ? 'late' : 'ontime')}>
                  {s.is_late ? 'LATE' : 'ON TIME'}
                </span>
                <button
                  className="reveal-btn"
                  onClick={function () { openFile(s) }}
                >
                  Open
                </button>
                {s.grade == null && !s.feedback && (
                  <button
                    className="reveal-btn"
                    style={{ background: 'var(--red-soft)', color: 'var(--red)' }}
                    onClick={function () { deleteSubmission(s) }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
