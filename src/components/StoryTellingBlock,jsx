import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function StoryTellingBlock({ item, user, homeworkId, day, cycleNumber }) {
  const extra = item.extra || {};
  const minSeconds = extra.min_seconds || 120;

  const [tries, setTries] = useState(0);
  const [prevTries, setPrevTries] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blobUrl, setBlobUrl] = useState(null);
  const [pendingBlob, setPendingBlob] = useState(null);
  const [pendingDuration, setPendingDuration] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const startRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(function () {
    let alive = true;
    async function load() {
      const { data } = await supabase
        .from('story_attempts')
        .select('cycle_number, accepted')
        .eq('student_id', user.id)
        .eq('content_id', item.id);
      if (!alive || !data) return;
      const cur = data.filter(function (r) { return r.cycle_number === cycleNumber; });
      const prev = data.filter(function (r) { return r.cycle_number === cycleNumber - 1; });
      setTries(cur.length);
      setPrevTries(prev.length > 0 ? prev.length : null);
      setCompleted(cur.some(function (r) { return r.accepted; }));
    }
    load();
    return function () { alive = false; };
  }, [item.id, user.id, cycleNumber]);

  async function logTry(duration, accepted) {
    const { data } = await supabase
      .from('story_attempts')
      .select('attempt_no')
      .eq('student_id', user.id)
      .eq('content_id', item.id)
      .eq('cycle_number', cycleNumber)
      .order('attempt_no', { ascending: false })
      .limit(1);
    const next = data && data.length > 0 ? data[0].attempt_no + 1 : 1;
    await supabase.from('story_attempts').insert({
      student_id: user.id,
      content_id: item.id,
      cycle_number: cycleNumber,
      attempt_no: next,
      duration_seconds: duration,
      accepted: accepted
    });
    setTries(next);
  }

  async function startRecording() {
    setMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      rec.ondataavailable = function (e) { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        const duration = Math.round((Date.now() - startRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (duration < minSeconds) {
          logTry(duration, false);
          setMessage('Too short - you need at least ' + fmt(minSeconds) + '. Try again.');
          setBlobUrl(null);
          setPendingBlob(null);
        } else {
          setPendingBlob(blob);
          setPendingDuration(duration);
          setBlobUrl(URL.createObjectURL(blob));
        }
      };
      mediaRef.current = rec;
      startRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(function () {
        setElapsed(Math.round((Date.now() - startRef.current) / 1000));
      }, 500);
      rec.start();
      setRecording(true);
    } catch (e) {
      setMessage('Microphone access failed.');
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    setRecording(false);
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
  }

  async function sendRecording() {
    if (!pendingBlob) return;
    setBusy(true);
    const path = user.id + '/story_' + item.id + '_c' + cycleNumber + '.webm';
    const { error: upErr } = await supabase.storage
      .from('submissions')
      .upload(path, pendingBlob, { upsert: true, contentType: 'audio/webm' });
    if (upErr) { setMessage('Upload failed. Try again.'); setBusy(false); return; }
    await supabase.from('submissions').insert({
      student_id: user.id,
      homework_id: homeworkId,
      day: day,
      kind: 'audio',
      storage_path: path
    });
    await logTry(pendingDuration, true);
    setCompleted(true);
    setPendingBlob(null);
    setBlobUrl(null);
    setBusy(false);
  }

  async function deleteRecording() {
    await logTry(pendingDuration, false);
    setPendingBlob(null);
    setBlobUrl(null);
    setMessage('Recording deleted. Record again when ready.');
  }

  function fmt(s) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  const timerOk = elapsed >= minSeconds;

  return (
    <div className="card">
      <div className="block-title">{item.block_title || 'Story telling'}</div>
      <p><strong>{item.prompt}</strong></p>
      {extra.guide ? <p className="st-guide">{extra.guide}</p> : null}
      <div className="rf-meta">
        Minimum: {fmt(minSeconds)} · Tries this cycle: {tries}
        {prevTries !== null ? ' · Last cycle: ' + prevTries + ' tries' : ''}
      </div>

      {completed ? (
        <div className="idb-done">This story is complete for this cycle.</div>
      ) : (
        <div>
          {recording ? (
            <div>
              <div className={timerOk ? 'idb-timer idb-timer-ok' : 'idb-timer'}>{fmt(elapsed)}</div>
              <button className="sub-btn" onClick={stopRecording}>Stop</button>
            </div>
          ) : blobUrl ? (
            <div>
              <audio controls src={blobUrl}></audio>
              <div className="pt-actions">
                <button className="sub-btn" disabled={busy} onClick={sendRecording}>Send</button>
                <button className="reveal-btn" disabled={busy} onClick={deleteRecording}>Delete and retry</button>
              </div>
            </div>
          ) : (
            <button className="sub-btn" onClick={startRecording}>Start recording</button>
          )}
          {message ? <div className="idb-error">{message}</div> : null}
        </div>
      )}
    </div>
  );
}
