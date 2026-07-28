import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function RapidFireBlock({ item, user, homeworkId, day, cycleNumber }) {
  const extra = item.extra || {};
  const items = extra.items || [];
  const limit = extra.time_limit_seconds || 60;

  const [mode, setMode] = useState('practice'); // practice | record
  const [recording, setRecording] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [duration, setDuration] = useState(0);
  const [tries, setTries] = useState(0);
  const [prevTries, setPrevTries] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const startRef = useRef(0);

  useEffect(function () {
    let alive = true;
    async function load() {
      const { data } = await supabase
        .from('rapid_fire_attempts')
        .select('cycle_number, attempt_no, accepted')
        .eq('student_id', user.id)
        .eq('content_id', item.id);
      if (!alive || !data) return;
      const cur = data.filter(function (a) { return a.cycle_number === cycleNumber; });
      const prev = data.filter(function (a) { return a.cycle_number === cycleNumber - 1; });
      setTries(cur.length);
      setPrevTries(prev.length > 0 ? prev.length : null);
      setDone(cur.some(function (a) { return a.accepted; }));
    }
    load();
    return function () { alive = false; };
  }, [item.id, user.id, cycleNumber]);

  async function startRecording() {
    setMsg('');
    setBlobUrl(null);
    setBlob(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = function (e) { chunksRef.current.push(e.data); };
      rec.onstop = function () {
        const b = new Blob(chunksRef.current, { type: 'audio/webm' });
        setBlob(b);
        setBlobUrl(URL.createObjectURL(b));
        setDuration((Date.now() - startRef.current) / 1000);
        stream.getTracks().forEach(function (t) { t.stop(); });
      };
      mediaRef.current = rec;
      startRef.current = Date.now();
      rec.start();
      setRecording(true);
    } catch (err) {
      setMsg('Microphone access denied.');
    }
  }

  function stopRecording() {
    if (mediaRef.current) mediaRef.current.stop();
    setRecording(false);
  }

  function discard() {
    setBlob(null);
    setBlobUrl(null);
    setMsg('');
  }

  async function send() {
    if (!blob || busy) return;
    setBusy(true);
    const attemptNo = tries + 1;
    const accepted = duration <= limit;

    await supabase.from('rapid_fire_attempts').insert({
      student_id: user.id,
      content_id: item.id,
      cycle_number: cycleNumber,
      attempt_no: attemptNo,
      duration_seconds: duration.toFixed(1),
      accepted: accepted
    });
    setTries(attemptNo);

    if (!accepted) {
      setMsg('Too long — try again.');
      setBlob(null);
      setBlobUrl(null);
      setBusy(false);
      return;
    }

    const path = user.id + '/rapidfire_' + item.id + '_c' + cycleNumber + '.webm';
    const { error: upErr } = await supabase.storage
      .from('submissions')
      .upload(path, blob, { upsert: true, contentType: 'audio/webm' });

    if (upErr) {
      setMsg('Upload failed. Please try sending again.');
      setBusy(false);
      return;
    }

    await supabase.from('submissions').insert({
      student_id: user.id,
      homework_id: homeworkId,
      day: day,
      kind: 'audio',
      storage_path: path
    });

    setDone(true);
    setMsg('Accepted. Homework complete.');
    setBlob(null);
    setBlobUrl(null);
    setBusy(false);
  }

  function showPractice() { setMode('practice'); }
  function showRecord() { setMode('record'); }

  return (
    <div className="card">
      <div className="block-title">{item.block_title || 'Rapid Fire'}</div>
      <p>{item.prompt}</p>

      <div className="rf-meta">
        <span>Tries this week: {tries}</span>
        {prevTries !== null && <span> · Last cycle: {prevTries} tries</span>}
        {done && <span className="pill"> Completed</span>}
      </div>

      <div className="rf-tabs">
        <button className="day-tab" onClick={showPractice} disabled={mode === 'practice'}>Practice</button>
        <button className="day-tab" onClick={showRecord} disabled={mode === 'record'}>Record</button>
      </div>

      {mode === 'practice' && (
        <ol className="rf-list">
          {items.map(function (it, i) {
            return (
              <li key={i}>
                <div>{it.en}</div>
                <div className="rf-fr">{it.fr}</div>
              </li>
            );
          })}
        </ol>
      )}

      {mode === 'record' && (
        <div>
          <ol className="rf-list">
            {items.map(function (it, i) {
              return <li key={i}>{it.en}</li>;
            })}
          </ol>

          {done ? (
            <p>This block is complete for this cycle.</p>
          ) : (
            <div>
              {!recording && !blobUrl && (
                <button className="sub-btn" onClick={startRecording}>Start recording</button>
              )}
              {recording && (
                <button className="sub-btn" onClick={stopRecording}>Stop recording</button>
              )}
              {blobUrl && (
                <div style={{ marginTop: 10 }}>
                  <audio controls src={blobUrl}></audio>
                  <div style={{ marginTop: 8 }}>
                    <button className="sub-btn" onClick={send} disabled={busy}>Send</button>
                    <button className="reveal-btn" onClick={discard} disabled={busy}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
        </div>
      )}
    </div>
  );
}