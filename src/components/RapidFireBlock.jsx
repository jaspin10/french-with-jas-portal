import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

function pickAudioFormat() {
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm')) {
    return { mime: 'audio/webm', ext: 'webm' };
  }
  return { mime: 'audio/mp4', ext: 'mp4' };
}

export default function RapidFireBlock({ item, user, homeworkId, day, cycleNumber }) {
  const extra = item.extra || {};
  const items = extra.items || [];

  const [mode, setMode] = useState('practice');
  const [recording, setRecording] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [duration, setDuration] = useState(0);
  const [tries, setTries] = useState(0);
  const [passedCount, setPassedCount] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [firstCycle, setFirstCycle] = useState(true);
  const [personalBest, setPersonalBest] = useState(null);
  const [benchmarks, setBenchmarks] = useState(null); // {top5, top10, top20}
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const startRef = useRef(0);
  const formatRef = useRef(pickAudioFormat());

  const isDebate = items.length === 1;
  const maxScore = isDebate ? 20 : 16;
  const minScore = isDebate ? 16 : 10;
  const REQUIRED_FIRST_CYCLE = 5;

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
      const curPassed = cur.filter(function (a) { return a.accepted; });
      setTries(cur.length);
      setPassedCount(curPassed.length);

      // History for this block TYPE (same day+block, any content_id incl. this one, older cycles)
      const { data: hist } = await supabase
        .from('rapid_fire_attempts')
        .select('duration_seconds, cycle_number, accepted, content_id, homework_content!inner(day, block)')
        .eq('student_id', user.id)
        .eq('homework_content.day', day)
        .eq('homework_content.block', item.block)
        .eq('accepted', true);
      if (!alive) return;

      const histRows = (hist || []).filter(function (h) {
        return !(h.content_id === item.id && h.cycle_number === cycleNumber);
      });
      const isFirst = histRows.length === 0;
      setFirstCycle(isFirst);
      setDone(isFirst ? curPassed.length >= REQUIRED_FIRST_CYCLE : curPassed.length >= 1);

      // Personal best across all accepted attempts of this block type (incl. current week)
      const allAccepted = (hist || []).concat([]);
      const curDur = curPassed.map(function (a) { return Number(a.duration_seconds); });
      const histDur = allAccepted.map(function (h) { return Number(h.duration_seconds); });
      const pool = histDur.concat(curDur).filter(function (n) { return n > 0; });
      if (pool.length > 0) setPersonalBest(Math.min.apply(null, pool));

      // Benchmarks
      const { data: tops } = await supabase.rpc('rapid_fire_top_times');
      if (!alive) return;
      const hit = (tops || []).find(function (t) {
        return t.day === day && t.block === item.block;
      });
      if (hit) setBenchmarks({ top5: hit.top5, top10: hit.top10, top20: hit.top20 });

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
      const fmtInfo = formatRef.current;
      let rec;
      try {
        rec = new MediaRecorder(stream, { mimeType: fmtInfo.mime });
      } catch (e) {
        rec = new MediaRecorder(stream);
      }
      chunksRef.current = [];
      rec.ondataavailable = function (e) { chunksRef.current.push(e.data); };
      rec.onstop = function () {
        const b = new Blob(chunksRef.current, { type: fmtInfo.mime });
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
        ? { audio_base64: b64, mime_type: formatRef.current.mime, mode: 'debate', text: items[0].fr }
        : {
            audio_base64: b64,
            mime_type: formatRef.current.mime,
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

    setChecking(true);
    setMsg('Checking your pronunciation...');
    const data = await transcribe(blob);
    setChecking(false);

    // No fail-open: API error = attempt does not count, retry
    if (data === null) {
      setMsg('The pronunciation check could not run. This attempt does not count — please send again.');
      setBusy(false);
      return;
    }

    const scoreOk = data.score >= minScore;

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
      setMsg('Pronunciation score ' + data.score + '/' + maxScore + ' — minimum is ' + minScore + '/' + maxScore + '. This attempt does not count. Practice and try again.');
      setBlob(null);
      setBlobUrl(null);
      setBusy(false);
      return;
    }

    const newPassed = passedCount + 1;
    setPassedCount(newPassed);
    if (personalBest === null || duration < personalBest) setPersonalBest(duration);

    const path = user.id + '/rapidfire_' + item.id + '_c' + cycleNumber + '.' + formatRef.current.ext;
    const { error: upErr } = await supabase.storage
      .from('submissions')
      .upload(path, blob, { upsert: true, contentType: formatRef.current.mime });

    if (upErr) {
      setMsg('Upload failed, but your attempt was counted. You can continue.');
    } else {
      const { data: existing } = await supabase
        .from('submissions')
        .select('id')
        .eq('student_id', user.id)
        .eq('storage_path', path)
        .maybeSingle();
      if (!existing) {
        await supabase.from('submissions').insert({
          student_id: user.id,
          homework_id: homeworkId,
          day: day,
          kind: 'audio',
          storage_path: path
        });
      }
    }

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
      .upsert(row, { onConflict: 'student_id,content_id,cycle_number' })
      .select()
      .maybeSingle();
    setResult(saved || row);

    const nowDone = firstCycle ? newPassed >= REQUIRED_FIRST_CYCLE : true;
    setDone(nowDone);
    if (nowDone) {
      setMsg('Accepted (' + fmt(duration) + '). Homework complete.');
    } else {
      setMsg('Accepted (' + fmt(duration) + '). Passed attempt ' + newPassed + ' of ' + REQUIRED_FIRST_CYCLE + ' — your fastest becomes your time to beat.');
    }
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

  function goalRow(label, value) {
    if (value === null || value === undefined) return null;
    const beaten = personalBest !== null && personalBest < Number(value);
    return (
      <div className="rf-goal-row" key={label}>
        <span className="rf-goal-label">{label}</span>
        <span className="rf-goal-time">{fmt(Number(value))}</span>
        {beaten && <span className="pill">Beaten</span>}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="block-title">{item.block_title || 'Rapid Fire'}</div>
      <p>{item.prompt}</p>

      <div className="rf-meta">
        <span>Tries this week: {tries}</span>
        {firstCycle && !done && <span> · First week: {passedCount} of {REQUIRED_FIRST_CYCLE} passed recordings · minimum score {minScore}/{maxScore}</span>}
        {!firstCycle && !done && <span> · One passed recording completes the block · minimum score {minScore}/{maxScore}</span>}
        {done && <span className="pill"> Completed</span>}
      </div>

      <div className="rf-goals">
        {personalBest !== null && (
          <div className="rf-goal-row">
            <span className="rf-goal-label">Your best</span>
            <span className="rf-goal-time">{fmt(personalBest)}</span>
          </div>
        )}
        {benchmarks && goalRow('Top 20 time', benchmarks.top20)}
        {benchmarks && goalRow('Top 10 time', benchmarks.top10)}
        {benchmarks && goalRow('Top 5 time', benchmarks.top5)}
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
            <p>This block is complete for this cycle. You can keep recording to chase a faster time.</p>
          ) : null}

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