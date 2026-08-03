import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

export default function ProcessTellingBlock(props) {
  const item = props.item;
  const user = props.user;
  const cycleNumber = props.cycleNumber;
  const homeworkId = props.homeworkId;
  const day = props.day;

  const extra = item.extra || {};
  const mode = extra.mode || 'step_by_step';
  const steps = extra.steps || [];
  const hideSteps = extra.hide_steps === true;
  const isStepMode = mode === 'step_by_step';

  const [activeStep, setActiveStep] = useState(1);
  const [attempts, setAttempts] = useState([]);
  const [prevAttempts, setPrevAttempts] = useState([]);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blobUrl, setBlobUrl] = useState(null);
  const [blobData, setBlobData] = useState(null);
  const [lastDuration, setLastDuration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const startRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(function () {
    loadAttempts();
  }, [item.id, cycleNumber]);

  async function loadAttempts() {
    const cur = await supabase
      .from('process_attempts')
      .select('*')
      .eq('student_id', user.id)
      .eq('content_id', item.id)
      .eq('cycle_number', cycleNumber);
    setAttempts(cur.data || []);

    const prev = await supabase
      .from('process_attempts')
      .select('*')
      .eq('student_id', user.id)
      .eq('content_id', item.id)
      .eq('cycle_number', cycleNumber - 1);
    setPrevAttempts(prev.data || []);
  }

  function attemptsFor(stepNo) {
    return attempts.filter(function (a) {
      return isStepMode ? a.step_no === stepNo : a.step_no === null;
    });
  }

  function prevAttemptsFor(stepNo) {
    return prevAttempts.filter(function (a) {
      return isStepMode ? a.step_no === stepNo : a.step_no === null;
    });
  }

  function isDone(stepNo) {
    return attemptsFor(stepNo).some(function (a) { return a.accepted; });
  }

  function prevBestDuration() {
    const list = prevAttemptsFor(null).filter(function (a) { return a.accepted; });
    if (list.length === 0) return 0;
    let best = 0;
    list.forEach(function (a) {
      if (a.duration_seconds > best) best = a.duration_seconds;
    });
    return best;
  }

  async function startRecording() {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = function (e) { chunksRef.current.push(e.data); };
      rec.onstop = function () {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setBlobData(blob);
        setBlobUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(function (t) { t.stop(); });
      };
      recRef.current = rec;
      rec.start();
      startRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timerRef.current = setInterval(function () {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 500);
    } catch (e) {
      setErr('Microphone access refused. Check browser permissions.');
    }
  }

  function stopRecording() {
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.stop();
    }
    clearInterval(timerRef.current);
    const dur = Math.floor((Date.now() - startRef.current) / 1000);
    setLastDuration(dur);
    setRecording(false);
  }

  function nextAttemptNo(stepNo) {
    const list = attemptsFor(stepNo);
    let max = 0;
    list.forEach(function (a) { if (a.attempt_no > max) max = a.attempt_no; });
    return max + 1;
  }

  async function logAttempt(stepNo, duration, accepted) {
    await supabase.from('process_attempts').insert({
      student_id: user.id,
      content_id: item.id,
      step_no: isStepMode ? stepNo : null,
      cycle_number: cycleNumber,
      attempt_no: nextAttemptNo(stepNo),
      duration_seconds: duration,
      accepted: accepted
    });
  }

  async function handleDelete() {
    setBusy(true);
    const stepNo = isStepMode ? activeStep : null;
    await logAttempt(stepNo, lastDuration, false);
    setBlobUrl(null);
    setBlobData(null);
    await loadAttempts();
    setBusy(false);
  }

  async function handleSend() {
    setBusy(true);
    setErr('');
    const stepNo = isStepMode ? activeStep : null;
    const path = isStepMode
      ? user.id + '/process_' + item.id + '_s' + activeStep + '_c' + cycleNumber + '.webm'
      : user.id + '/process_' + item.id + '_c' + cycleNumber + '.webm';

    const up = await supabase.storage
      .from('submissions')
      .upload(path, blobData, { upsert: true, contentType: 'audio/webm' });

    if (up.error) {
      setErr('Upload failed. Try again.');
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

    await logAttempt(stepNo, lastDuration, true);
    setBlobUrl(null);
    setBlobData(null);
    await loadAttempts();
    setBusy(false);
  }

  const stepNoForView = isStepMode ? activeStep : null;
  const tries = attemptsFor(stepNoForView).length;
  const prevTries = prevAttemptsFor(stepNoForView).length;
  const done = isDone(stepNoForView);
  const hasPrevCycle = prevAttempts.length > 0;

  return (
    <div className="card">
      <div className="block-title">{item.block_title || 'Process telling'}</div>
      <p className="rf-meta">{item.prompt}</p>

      {!hideSteps && (
        <ol className="pt-steps">
          {steps.map(function (s, i) {
            return <li key={i}>{s}</li>;
          })}
        </ol>
      )}

      {isStepMode && (
        <div className="rf-tabs">
          {steps.map(function (s, i) {
            const n = i + 1;
            const cls = isDone(n) ? 'pill pill-done' : (n === activeStep ? 'pill pill-active' : 'pill');
            return (
              <button key={n} className={cls} onClick={function () {
                if (!recording && !blobUrl) setActiveStep(n);
              }}>
                {isDone(n) ? n + ' OK' : n}
              </button>
            );
          })}
        </div>
      )}

      {done ? (
        <div className="idb-done">
          {isStepMode
            ? 'Step ' + activeStep + ' is complete for this cycle.'
            : 'This block is complete for this cycle.'}
          {!isStepMode && (
            <div className="rf-meta">
              Duration: {fmtTime(attemptsFor(null).filter(function (a) { return a.accepted; })[0].duration_seconds)}
              {hasPrevCycle && prevBestDuration() > 0 && ' - last cycle: ' + fmtTime(prevBestDuration())}
            </div>
          )}
        </div>
      ) : (
        <div>
          {!recording && !blobUrl && (
            <button className="sub-btn" onClick={startRecording} disabled={busy}>
              {isStepMode ? 'Record step ' + activeStep : 'Record the full process'}
            </button>
          )}

          {recording && (
            <div>
              <div className="idb-timer idb-timer-ok">{fmtTime(elapsed)}</div>
              <button className="sub-btn" onClick={stopRecording}>Stop</button>
            </div>
          )}

          {blobUrl && !recording && (
            <div>
              <div className="rf-meta">Duration: {fmtTime(lastDuration)}</div>
              <audio controls src={blobUrl}></audio>
              <div className="pt-actions">
                <button className="sub-btn" onClick={handleSend} disabled={busy}>Send</button>
                <button className="reveal-btn" onClick={handleDelete} disabled={busy}>Delete and retry</button>
              </div>
            </div>
          )}

          <div className="rf-meta">
            Tries this cycle: {tries}
            {hasPrevCycle && ' - last cycle: ' + prevTries}
            {!isStepMode && hasPrevCycle && prevBestDuration() > 0 && ' - last cycle duration: ' + fmtTime(prevBestDuration())}
          </div>
        </div>
      )}

      {err && <div className="idb-error">{err}</div>}
    </div>
  );
}