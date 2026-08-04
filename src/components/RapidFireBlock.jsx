import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function RapidFireBlock({ item, user, homeworkId, day, cycleNumber }) {
  const extra = item.extra || {};
  const items = extra.items || [];

  const [mode, setMode] = useState('practice');
  const [recording, setRecording] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [duration, setDuration] = useState(0);
  const [tries, setTries] = useState(0);
  const [prevTries, setPrevTries] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [threshold, setThreshold] = useState(null); // null = first cycle for this block type
  const [result, setResult] = useState(null); // saved transcript row
  const [checking, setChecking] = useState(false);

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const startRef = useRef(0);

  const isDebate = items.length === 1;
  const maxScore = isDebate ? 20 : 16;
  const minScore = isDebate ? 16 : 10;

  useEffect(function () {
    let alive = true;
    async function load() {
      const { data } = await supabase
        .from('rapid_fire_attempts')
        .select('cycle_number, attempt_no, accepted, duration_seconds')
        .eq('student_id', user.id)
        .eq('content_id', item.id);
      if (!alive) return;
      const rows = data || [];
      const cur = rows.filter(function (a) { return a.cycle_number === cycleNumber; });
      const prev = rows.filter(function (a) { return a.cycle_number === cycleNumber - 1; });
      setTries(cur.length);
      setPrevTries(prev.length > 0 ? prev.length : null);
      setDone(cur.some(function (a) { return a.accepted; }));

      // Personal threshold: fastest duration from the most recent previous cycle
      // of this block TYPE (same day+block, different content_id).
      const { data: hist } = await supabase
        .from('rapid_fire_attempts')
        .select('duration_seconds, cycle_number, homework_content!inner(day, block)')
        .eq('student_id', user.id)
        .eq('homework_content.day', day)
        .eq('homework_content.block', item.block)
        .neq('content_id', item.id)
        .order('cycle_number', { ascending: false });
      if (!alive) return;
      if (hist && hist.length > 0) {
        const lastCycle = hist[0].cycle_number;
        const lastRows = hist.filter(function (h) { return h.cycle_number === lastCycle; });
        const best = Math.min.apply(null, lastRows.map(function (h) { return Number(h.duration_seconds); }));
        setThreshold(best + 5);
      }

      // Load an existing transcript result if the block is already done
      const { data: tr } = await supabase
        .from('rapid_fire_transcripts')
        .select('*')
        .eq('student_id', user.id)
        .eq('content_id', item.id)
        .eq('cycle_number', cycleNumber)
        .maybeSingle();
      if (!alive) return;
      if (tr) setResult(tr);
    }
    load();
    return function () { alive = false; };
  }, [item.id, user.id, cycleNumber, day, item.block]);

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

  function blobToBase64(b) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(r.result.split(',')[1]); };
      r.onerror = function () { reject(new Error('read failed')); };
      r.readAsDataURL(b);
    });
  }

  async function transcribe(sentBlob) {
    try {
      const b64 = await blobToBase64(sentBlob);
      const payload = isDebate
        ? { audio_base64: b64, mime_type: 'audio/webm', mode: 'debate', text: items[0].fr }
        : {
            audio_base64: b64,
            mime_type: 'audio/webm',
            mode: 'list',
            items: items.map(function (it) { return it.fr; })
          };
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (typeof data.score !== 'number') return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  async function send() {
    if (!blob || busy) return;
    setBusy(true);
    setMsg('');
    const attemptNo = tries + 1;
    const firstCycle = threshold === null;

    // Gate 1: time (only after first cycle)
    if (!firstCycle && duration > threshold) {
      await supabase.from('rapid_fire_attempts').insert({
        student_id: user.id,
        content_id: item.id,
        cycle_number: cycleNumber,
        attempt_no: attemptNo,
        duration_seconds: duration.toFixed(1),
        accepted: false
      });
      setTries(attemptNo);
      setMsg('Too long — try again.');
      setBlob(null);
      setBlobUrl(null);
      setBusy(false);
      return;
    }

    // First cycle: attempts 1-4 are practice sends, not checked
    if (firstCycle && attemptNo < 5) {
      await supabase.from('rapid_fire_attempts').insert({
        student_id: user.id,
        content_id: item.id,
        cycle_number: cycleNumber,
        attempt_no: attemptNo,
        duration_seconds: duration.toFixed(1),
        accepted: false
      });
      setTries(attemptNo);
      setMsg('Recorded (' + fmt(duration) + '). Attempt ' + attemptNo + ' of 5 — your 5th recording will be checked and submitted.');
      setBlob(null);
      setBlobUrl(null);
      setBusy(false);
      return;
    }

    // Gate 2: pronunciation check before acceptance
    setChecking(true);
    setMsg('Checking your pronunciation...');
    const data = await transcribe(blob);
    setChecking(false);

    // Fail open: if the AI is unreachable, accept without a score (never block students)
    const scoreOk = data === null ? true : data.score >= minScore;

    await supabase.from('rapid_fire_attempts').insert({
      student_id: user.id,
      content_id: item.id,
      cycle_number: cycleNumber,
      attempt_no: attemptNo,
      duration_seconds: duration.toFixed(1),
      accepted: scoreOk
    });
    setTries(attemptNo);

    if (!scoreOk) {
      setMsg('Pronunciation score ' + data.score + '/' + maxScore + ' — minimum is ' + minScore + '/' + maxScore + '. Practice and try again.');
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

    if (data !== null) {
      const row = {
        student_id: user.id,
        content_id: item.id,
        cycle_number: cycleNumber,
        transcript: data.transcript || '',
        score: data.score,
        max_score: maxScore,
        mistakes: isDebate ? (data.mistakes || []) : (data.results || []).filter(function (r) { return !r.correct; }),
        ai_note: data.note || ''
      };
      const { data: saved } = await supabase
        .from('rapid_fire_transcripts')
        .insert(row)
        .select()
        .maybeSingle();
      setResult(saved || row);
    }

    setDone(true);
    setMsg('Accepted. Homework complete.');
    setBlob(null);
    setBlobUrl(null);
    setBusy(false);
  }

  function showPractice() { setMode('practice'); }
  function showRecord() { setMode('record'); }

  function fmt(s) {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  return (
    <div className="card">
      <div className="block-title">{item.block_title || 'Rapid Fire'}</div>
      <p>{item.prompt}</p>

      <div className="rf-meta">
        <span>Tries this week: {tries}</span>
        {prevTries !== null && <span> · Last cycle: {prevTries} tries</span>}
        {threshold !== null && !done && <span> · Target: under {fmt(threshold)} · minimum score {minScore}/{maxScore}</span>}
        {threshold === null && !done && <span> · First week: attempt {Math.min(tries + 1, 5)} of 5, the 5th is checked and submitted</span>}
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

      {checking && <p className="rf-checking">Checking your pronunciation...</p>}

      {result && (
        <div className="rf-result">
          <div className="rf-result-score">
            Pronunciation: {result.score} / {result.max_score}
          </div>
          {result.mistakes && result.mistakes.length > 0 && (
            <div className="rf-result-mistakes">
              {result.mistakes.map(function (m, i) {
                return (
                  <span className="rf-mistake-pill" key={i}>
                    {isDebate
                      ? (m.expected || '') + (m.heard ? ' — heard: ' + m.heard : '')
                      : 'Sentence ' + m.n + (m.issue ? ': ' + m.issue : '')}
                  </span>
                );
              })}
            </div>
          )}
          {result.ai_note && <p className="rf-result-note">{result.ai_note}</p>}
          {result.transcript && (
            <details className="rf-transcript">
              <summary>What the AI heard</summary>
              <p>{result.transcript}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}