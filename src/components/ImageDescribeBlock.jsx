import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const STEP_KEYS = [1, 2, 3];

export default function ImageDescribeBlock({ item, user, homeworkId, day, cycleNumber }) {
  const extra = item.extra || {};
  const steps = extra.steps || [];
  const imageUrl = extra.image_url;

  const [attempts, setAttempts] = useState([]);
  const [activeStep, setActiveStep] = useState(1);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pendingBlob, setPendingBlob] = useState(null);
  const [pendingDuration, setPendingDuration] = useState(0);
  const [pendingUrl, setPendingUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const startRef = useRef(0);
  const tickRef = useRef(null);

  useEffect(function () {
    loadAttempts();
    return function () {
      stopTick();
      if (mediaRef.current && mediaRef.current.state !== 'inactive') {
        mediaRef.current.stop();
      }
    };
  }, []);

  async function loadAttempts() {
    const { data } = await supabase
      .from('image_describe_attempts')
      .select('*')
      .eq('student_id', user.id)
      .eq('content_id', item.id)
      .order('created_at', { ascending: true });
    setAttempts(data || []);
  }

  function attemptsFor(stepNo, cycle) {
    return attempts.filter(function (a) {
      return a.step_no === stepNo && a.cycle_number === cycle;
    });
  }

  function isStepDone(stepNo) {
    return attemptsFor(stepNo, cycleNumber).some(function (a) { return a.accepted; });
  }

  function stepConfig(stepNo) {
    return steps.find(function (s) { return s.step === stepNo; }) || {};
  }

  function stopTick() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  async function startRecording() {
    setError('');
    clearPending();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      rec.ondataavailable = function (e) {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const dur = Math.round((Date.now() - startRef.current) / 1000);
        handleStop(blob, dur);
      };
      mediaRef.current = rec;
      startRef.current = Date.now();
      setElapsed(0);
      rec.start();
      setRecording(true);
      tickRef.current = setInterval(function () {
        setElapsed(Math.round((Date.now() - startRef.current) / 1000));
      }, 500);
    } catch (e) {
      setError('Microphone access denied. Please allow the microphone and try again.');
    }
  }

  function stopRecording() {
    stopTick();
    setRecording(false);
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
    }
  }

  async function handleStop(blob, dur) {
    const cfg = stepConfig(activeStep);
    const minSec = cfg.min_seconds || 60;
    if (dur < minSec) {
      // too short: log the try, discard the recording
      await logAttempt(dur, false);
      setError('Too short. You spoke for ' + fmt(dur) + ' but the minimum is ' + fmt(minSec) + '. Try again.');
      await loadAttempts();
    } else {
      const url = URL.createObjectURL(blob);
      setPendingBlob(blob);
      setPendingDuration(dur);
      setPendingUrl(url);
    }
  }

  async function logAttempt(dur, accepted) {
    const prev = attemptsFor(activeStep, cycleNumber);
    await supabase.from('image_describe_attempts').insert({
      student_id: user.id,
      content_id: item.id,
      step_no: activeStep,
      cycle_number: cycleNumber,
      attempt_no: prev.length + 1,
      duration_seconds: dur,
      accepted: accepted
    });
  }

  function clearPending() {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingBlob(null);
    setPendingUrl(null);
    setPendingDuration(0);
  }

  async function discardPending() {
    // discarding a valid recording still counts as a try
    await logAttempt(pendingDuration, false);
    clearPending();
    await loadAttempts();
  }

  async function sendPending() {
    if (!pendingBlob) return;
    setBusy(true);
    setError('');
    const path = user.id + '/imgdesc_' + item.id + '_s' + activeStep + '_c' + cycleNumber + '.webm';
    const up = await supabase.storage.from('submissions').upload(path, pendingBlob, {
      contentType: 'audio/webm',
      upsert: true
    });
    if (up.error) {
      setBusy(false);
      setError('Upload failed. Please try again.');
      return;
    }
    await logAttempt(pendingDuration, true);
    await supabase.from('submissions').insert({
      student_id: user.id,
      homework_id: homeworkId,
      day: day,
      kind: 'audio',
      storage_path: path
    });
    clearPending();
    setBusy(false);
    await loadAttempts();
  }

  function fmt(s) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  }

  function selectStep(stepNo) {
    if (recording || busy) return;
    stopTick();
    clearPending();
    setError('');
    setActiveStep(stepNo);
  }

  const cfg = stepConfig(activeStep);
  const minSec = cfg.min_seconds || 60;
  const done = isStepDone(activeStep);
  const tries = attemptsFor(activeStep, cycleNumber).length;
  const prevTries = attemptsFor(activeStep, cycleNumber - 1).length;
  const allDone = STEP_KEYS.every(isStepDone);
  const reached = elapsed >= minSec;

  return (
    <div className="card">
      <div className="block-title">{item.block_title || 'Image description'}</div>
      <p>{item.prompt}</p>
      {imageUrl && <img src={imageUrl} alt="Homework" className="idb-image" />}

      <div className="rf-tabs">
        {STEP_KEYS.map(function (n) {
          const c = stepConfig(n);
          return (
            <button
              key={n}
              className={'pill' + (activeStep === n ? ' pill-active' : '') + (isStepDone(n) ? ' pill-done' : '')}
              onClick={function () { selectStep(n); }}
            >
              {'Step ' + n + ' - ' + (c.label || '') + (isStepDone(n) ? ' (done)' : '')}
            </button>
          );
        })}
      </div>

      <div className="rf-meta">
        Minimum time: {fmt(minSec)}
        {' | Tries this cycle: ' + tries}
        {prevTries > 0 ? ' | Last cycle: ' + prevTries + ' tries' : ''}
      </div>

      {done ? (
        <div className="idb-done">This step is complete for this cycle.</div>
      ) : (
        <div>
          {!recording && !pendingBlob && (
            <button className="sub-btn" onClick={startRecording}>Start recording</button>
          )}
          {recording && (
            <div>
              <div className={'idb-timer' + (reached ? ' idb-timer-ok' : '')}>
                {fmt(elapsed)} / {fmt(minSec)}
                {reached ? ' - minimum reached, you can stop' : ''}
              </div>
              <button className="sub-btn" onClick={stopRecording}>Stop recording</button>
            </div>
          )}
          {pendingBlob && (
            <div>
              <div className="idb-timer idb-timer-ok">Recorded {fmt(pendingDuration)}</div>
              <audio controls src={pendingUrl}></audio>
              <div>
                <button className="sub-btn" disabled={busy} onClick={sendPending}>
                  {busy ? 'Sending...' : 'Send'}
                </button>
                <button className="reveal-btn" disabled={busy} onClick={discardPending}>Delete and retry</button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="idb-error">{error}</div>}
      {allDone && <div className="idb-done">All three steps complete. Great work.</div>}
    </div>
  );
}