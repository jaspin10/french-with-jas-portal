import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

function pickAudioFormat() {
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm')) {
    return { mime: 'audio/webm', ext: 'webm' };
  }
  return { mime: 'audio/mp4', ext: 'mp4' };
}

function formatSeconds(s) {
  if (s === null || s === undefined) return '-';
  var n = Math.round(Number(s));
  var m = Math.floor(n / 60);
  var r = n % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

var PASS_SCORE = 14;
var MAX_SCORE = 16;

export default function ChallengeRapidFire(props) {
  var challenge = props.challenge;
  var profile = props.profile;

  var [items, setItems] = useState([]);
  var [loading, setLoading] = useState(true);
  var [tab, setTab] = useState('practice');

  var [recording, setRecording] = useState(false);
  var [audioBlob, setAudioBlob] = useState(null);
  var [audioUrl, setAudioUrl] = useState(null);
  var [duration, setDuration] = useState(null);
  var [checking, setChecking] = useState(false);
  var [errorMsg, setErrorMsg] = useState('');

  var [attempts, setAttempts] = useState([]);
  var [transcriptRow, setTranscriptRow] = useState(null);
  var [lastResult, setLastResult] = useState(null);
  var [tops, setTops] = useState(null);

  var mediaRef = useRef(null);
  var chunksRef = useRef([]);
  var startedAtRef = useRef(null);
  var formatRef = useRef(pickAudioFormat());

  useEffect(function () {
    loadAll();
    return function () {
      stopStream();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [challenge.id]);

  async function loadAll() {
    setLoading(true);

    var itemsRes = await supabase
      .from('challenge_items')
      .select('*')
      .eq('challenge_id', challenge.id)
      .order('position', { ascending: true });

    var attRes = await supabase
      .from('challenge_attempts')
      .select('*')
      .eq('student_id', profile.id)
      .eq('challenge_id', challenge.id)
      .order('attempt_no', { ascending: true });

    var trRes = await supabase
      .from('challenge_transcripts')
      .select('*')
      .eq('student_id', profile.id)
      .eq('challenge_id', challenge.id)
      .maybeSingle();

    var topsRes = await supabase.rpc('challenge_top_times');

    setItems(itemsRes.data || []);
    setAttempts(attRes.data || []);
    setTranscriptRow(trRes.data || null);

    var myTops = null;
    if (topsRes.data) {
      for (var i = 0; i < topsRes.data.length; i++) {
        if (topsRes.data[i].challenge_id === challenge.id) {
          myTops = topsRes.data[i];
          break;
        }
      }
    }
    setTops(myTops);
    setLoading(false);
  }

  function acceptedAttempts() {
    var out = [];
    for (var i = 0; i < attempts.length; i++) {
      if (attempts[i].accepted) out.push(attempts[i]);
    }
    return out;
  }

  function personalBest() {
    var acc = acceptedAttempts();
    var best = null;
    for (var i = 0; i < acc.length; i++) {
      var d = Number(acc[i].duration_seconds);
      if (!isNaN(d) && (best === null || d < best)) best = d;
    }
    return best;
  }

  function isCompleted() {
    return acceptedAttempts().length > 0;
  }

  function nextAttemptNo() {
    var max = 0;
    for (var i = 0; i < attempts.length; i++) {
      if (attempts[i].attempt_no > max) max = attempts[i].attempt_no;
    }
    return max + 1;
  }

  function stopStream() {
    if (mediaRef.current && mediaRef.current.stream) {
      var tracks = mediaRef.current.stream.getTracks();
      for (var i = 0; i < tracks.length; i++) tracks[i].stop();
    }
    mediaRef.current = null;
  }

  async function startRecording() {
    setErrorMsg('');
    setLastResult(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
    setDuration(null);

    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      var recorder = new MediaRecorder(stream, { mimeType: formatRef.current.mime });
      chunksRef.current = [];

      recorder.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = function () {
        var blob = new Blob(chunksRef.current, { type: formatRef.current.mime });
        var secs = (Date.now() - startedAtRef.current) / 1000;
        setAudioBlob(blob);
        setDuration(secs);
        setAudioUrl(URL.createObjectURL(blob));
        stopStream();
      };

      mediaRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setRecording(true);
    } catch (err) {
      setErrorMsg('Microphone access failed. Please allow the microphone and try again.');
    }
  }

  function stopRecording() {
    if (mediaRef.current && mediaRef.current.state === 'recording') {
      mediaRef.current.stop();
    }
    setRecording(false);
  }

  function deleteRecording() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(null);
    setLastResult(null);
  }

  async function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var res = reader.result;
        resolve(res.split(',')[1]);
      };
      reader.onerror = function () { reject(new Error('Read failed')); };
      reader.readAsDataURL(blob);
    });
  }

  async function sendRecording() {
    if (!audioBlob || checking) return;
    setChecking(true);
    setErrorMsg('');

    var attemptNo = nextAttemptNo();
    var result = null;

    try {
      var base64 = await blobToBase64(audioBlob);
      var sentences = [];
      for (var i = 0; i < items.length; i++) {
        sentences.push(items[i].correction);
      }

      var res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'list',
          items: sentences,
          audio_base64: base64,
          mime_type: formatRef.current.mime
        })
      });

      if (!res.ok) throw new Error('Transcription failed');
      result = await res.json();
      if (result === null || typeof result.score !== 'number') throw new Error('Bad response');
    } catch (err) {
      setChecking(false);
      setErrorMsg('Could not check your pronunciation. Nothing was saved - please send again.');
      return;
    }

    var passed = result.score >= PASS_SCORE;

    var wrongList = [];
    var resultsArr = result.results || [];
    for (var j = 0; j < resultsArr.length; j++) {
      if (resultsArr[j] && resultsArr[j].correct === false) {
        var label = 'Sentence ' + resultsArr[j].n;
        if (resultsArr[j].issue) label = label + ': ' + resultsArr[j].issue;
        wrongList.push(label);
      }
    }

    var insertRes = await supabase.from('challenge_attempts').insert({
      student_id: profile.id,
      challenge_id: challenge.id,
      attempt_no: attemptNo,
      duration_seconds: duration,
      accepted: passed,
      score: result.score,
      max_score: MAX_SCORE
    });

    if (insertRes.error) {
      setChecking(false);
      setErrorMsg('Could not save your attempt. Please try again.');
      return;
    }

    if (passed) {
      var path = profile.id + '/challenge_' + challenge.id + '.' + formatRef.current.ext;
      await supabase.storage.from('submissions').upload(path, audioBlob, {
        upsert: true,
        contentType: formatRef.current.mime
      });

      await supabase.from('challenge_transcripts').upsert({
        student_id: profile.id,
        challenge_id: challenge.id,
        transcript: result.transcript || null,
        score: result.score,
        max_score: MAX_SCORE,
        mistakes: wrongList,
        ai_note: result.note || null
      }, { onConflict: 'student_id,challenge_id' });
    }

    setLastResult({ passed: passed, score: result.score, note: result.note || '', transcript: result.transcript || '', mistakes: wrongList });
    deleteRecordingKeepResult();
    setChecking(false);
    await loadAll();
    if (passed && props.onCompleted) props.onCompleted();
  }

  function deleteRecordingKeepResult() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(null);
  }

  if (loading) {
    return <p className="muted">Loading exercise...</p>;
  }

  var best = personalBest();
  var completed = isCompleted();

  return (
    <div className="ch-rf">
      <div className="ch-rf-meta">
        <span className={'ch-rf-pill' + (completed ? ' done' : '')}>
          {completed ? 'Completed' : 'Not completed'}
        </span>
        <span className="ch-rf-pill">Pass: {PASS_SCORE}/{MAX_SCORE}</span>
        {best !== null ? <span className="ch-rf-pill">Your best: {formatSeconds(best)}</span> : null}
      </div>

      <GoalsPanel best={best} tops={tops} />

      <div className="ch-rf-tabs">
        <button
          className={'ch-rf-tab' + (tab === 'practice' ? ' active' : '')}
          onClick={function () { setTab('practice'); }}
        >
          Practice
        </button>
        <button
          className={'ch-rf-tab' + (tab === 'record' ? ' active' : '')}
          onClick={function () { setTab('record'); }}
        >
          Record
        </button>
      </div>

      <ol className="ch-rf-items">
        {items.map(function (item) {
          return (
            <li key={item.id} className="ch-rf-item">
              <span className="ch-rf-en">{item.prompt}</span>
              {tab === 'practice' ? <span className="ch-rf-fr">{item.correction}</span> : null}
            </li>
          );
        })}
      </ol>

      {tab === 'record' ? (
        <div className="ch-rf-recorder">
          {!recording && !audioBlob ? (
            <button className="ch-rf-btn primary" onClick={startRecording} disabled={checking}>
              Start recording
            </button>
          ) : null}

          {recording ? (
            <button className="ch-rf-btn danger" onClick={stopRecording}>
              Stop
            </button>
          ) : null}

          {audioBlob && !recording ? (
            <div className="ch-rf-review">
              <audio controls src={audioUrl}></audio>
              <div className="ch-rf-review-actions">
                <button className="ch-rf-btn primary" onClick={sendRecording} disabled={checking}>
                  {checking ? 'Checking...' : 'Send'}
                </button>
                <button className="ch-rf-btn" onClick={deleteRecording} disabled={checking}>
                  Delete and retry
                </button>
              </div>
              {duration !== null ? <p className="muted">Duration: {formatSeconds(duration)}</p> : null}
            </div>
          ) : null}

          {errorMsg ? <p className="ch-rf-error">{errorMsg}</p> : null}

          {lastResult ? (
            <div className={'ch-rf-result' + (lastResult.passed ? ' pass' : ' fail')}>
              <div className="ch-rf-result-score">
                {lastResult.score}/{MAX_SCORE} - {lastResult.passed ? 'Passed!' : 'Not passed. Try again!'}
              </div>
              {lastResult.note ? <p className="ch-rf-note">{lastResult.note}</p> : null}
              {lastResult.mistakes && lastResult.mistakes.length > 0 ? (
                <div className="ch-rf-mistakes">
                  {lastResult.mistakes.map(function (m, idx) {
                    return <span key={idx} className="ch-rf-mistake-pill">{m}</span>;
                  })}
                </div>
              ) : null}
              {lastResult.transcript ? (
                <details className="ch-rf-transcript">
                  <summary>Transcript</summary>
                  <p>{lastResult.transcript}</p>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GoalsPanel(props) {
  var best = props.best;
  var tops = props.tops;

  var goals = [];
  if (tops && tops.top20 !== null && tops.top20 !== undefined) goals.push({ label: 'Top 20 time', value: Number(tops.top20) });
  if (tops && tops.top10 !== null && tops.top10 !== undefined) goals.push({ label: 'Top 10 time', value: Number(tops.top10) });
  if (tops && tops.top5 !== null && tops.top5 !== undefined) goals.push({ label: 'Top 5 time', value: Number(tops.top5) });

  if (goals.length === 0 && best === null) return null;

  return (
    <div className="ch-rf-goals">
      {best !== null ? (
        <div className="ch-rf-goal">
          <span className="ch-rf-goal-label">Your best</span>
          <span className="ch-rf-goal-value">{formatSeconds(best)}</span>
        </div>
      ) : null}
      {goals.map(function (g) {
        var beaten = best !== null && best < g.value;
        return (
          <div key={g.label} className={'ch-rf-goal' + (beaten ? ' beaten' : '')}>
            <span className="ch-rf-goal-label">{g.label}</span>
            <span className="ch-rf-goal-value">{formatSeconds(g.value)}</span>
            {beaten ? <span className="ch-rf-beaten-pill">Beaten</span> : null}
          </div>
        );
      })}
    </div>
  );
}