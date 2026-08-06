import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const THREE_HOURS = 3 * 60 * 60 * 1000;
const THIRTY_MIN = 30 * 60 * 1000;

const MISTAKE_LABELS = {
  word_order: 'Word order',
  spelling: 'Spelling',
  accents: 'Accents',
  punctuation: 'Punctuation',
  capitalization: 'Capitalization',
  tense: 'Tense',
  conjugation: 'Conjugation',
  agreement: 'Agreement',
  article: 'Article',
  preposition: 'Preposition',
  vocabulary: 'Vocabulary',
  missing_words: 'Missing words',
  extra_words: 'Extra words',
  elision: 'Elision'
};

function countWords(text) {
  const t = (text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function formatClock(ms) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

export default function LivePage(props) {
  const profile = props.profile;
  const [loading, setLoading] = useState(true);
  const [activation, setActivation] = useState(null);
  const [task, setTask] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answer, setAnswer] = useState('');
  const [now, setNow] = useState(Date.now());
  const [grading, setGrading] = useState(false);
  const [saveState, setSaveState] = useState('');

  const answerRef = useRef('');
  const attemptRef = useRef(null);
  const lockedRef = useRef(false);

  useEffect(function () {
    answerRef.current = answer;
  }, [answer]);

  useEffect(function () {
    attemptRef.current = attempt;
  }, [attempt]);

  useEffect(function () {
    load();
    const tick = setInterval(function () { setNow(Date.now()); }, 1000);
    return function () { clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data: taskRows } = await supabase
      .from('live_tasks')
      .select('*')
      .eq('level', profile.level);
    const list = taskRows || [];
    if (list.length === 0) { setLoading(false); return; }
    const ids = list.map(function (t) { return t.id; });
    const since = new Date(Date.now() - THREE_HOURS).toISOString();
    const { data: actRows } = await supabase
      .from('live_activations')
      .select('*')
      .in('task_id', ids)
      .eq('ended_early', false)
      .gte('activated_at', since)
      .order('activated_at', { ascending: false });
    const act = (actRows && actRows[0]) || null;
    if (!act) { setLoading(false); return; }
    const matching = list.find(function (t) { return t.id === act.task_id; });
    setActivation(act);
    setTask(matching || null);

    const { data: existing } = await supabase
      .from('live_attempts')
      .select('*')
      .eq('student_id', profile.id)
      .eq('activation_id', act.id)
      .maybeSingle();
    if (existing) {
      setAttempt(existing);
      setAnswer(existing.answer || '');
    }
    setLoading(false);
  }

  // Autosave every 10s while unlocked
  useEffect(function () {
    if (!activation) return;
    const t = setInterval(function () {
      autosave();
    }, 10000);
    return function () { clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activation]);

  async function ensureAttempt() {
    if (attemptRef.current) return attemptRef.current;
    const { data: inserted, error } = await supabase
      .from('live_attempts')
      .insert({
        student_id: profile.id,
        activation_id: activation.id,
        answer: answerRef.current,
        words_typed: countWords(answerRef.current)
      })
      .select('*')
      .single();
    if (error) {
      // Row may already exist (race) - reload it
      const { data: existing } = await supabase
        .from('live_attempts')
        .select('*')
        .eq('student_id', profile.id)
        .eq('activation_id', activation.id)
        .maybeSingle();
      if (existing) { setAttempt(existing); return existing; }
      return null;
    }
    setAttempt(inserted);
    return inserted;
  }

  async function autosave() {
    if (lockedRef.current) return;
    if (!activation) return;
    if (!answerRef.current.trim() && !attemptRef.current) return;
    const row = await ensureAttempt();
    if (!row) return;
    if (row.locked_at) return;
    setSaveState('Saving...');
    await supabase
      .from('live_attempts')
      .update({
        answer: answerRef.current,
        words_typed: countWords(answerRef.current)
      })
      .eq('id', row.id);
    setSaveState('Saved');
  }

  async function lockAndGrade() {
    if (lockedRef.current) return;
    lockedRef.current = true;
    const row = await ensureAttempt();
    if (!row) return;
    if (row.locked_at) { setAttempt(row); return; }

    const lockedAt = new Date().toISOString();
    const finalAnswer = answerRef.current;
    const words = countWords(finalAnswer);

    await supabase
      .from('live_attempts')
      .update({ answer: finalAnswer, words_typed: words, locked_at: lockedAt })
      .eq('id', row.id);

    setGrading(true);
    let score = null;
    let feedback = null;
    let corrected = null;
    let mistakes = null;
    try {
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'paragraph',
          prompt: task.paragraph,
          answer: finalAnswer
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.score === 'number') score = data.score;
        if (data.note) feedback = data.note;
        if (data.corrected) corrected = data.corrected;
        if (data.mistakes) mistakes = data.mistakes;
      }
    } catch (e) {
      // API failed - answer stays saved without a score
    }

    const patch = {};
    if (score !== null) patch.ai_score = score;
    if (feedback) patch.ai_feedback = feedback;
    if (corrected) patch.corrected = corrected;
    if (mistakes) patch.mistakes = mistakes;

    if (Object.keys(patch).length > 0) {
      await supabase.from('live_attempts').update(patch).eq('id', row.id);
    }

    const { data: fresh } = await supabase
      .from('live_attempts')
      .select('*')
      .eq('id', row.id)
      .single();
    if (fresh) setAttempt(fresh);
    setGrading(false);
  }

  // Timer logic
  const activatedMs = activation ? new Date(activation.activated_at).getTime() : 0;
  const solveRemaining = activation ? (activatedMs + THIRTY_MIN) - now : 0;
  const windowRemaining = activation ? (activatedMs + THREE_HOURS) - now : 0;
  const timeUp = activation && solveRemaining <= 0;
  const isLocked = (attempt && attempt.locked_at) || timeUp;

  // Fire lock exactly once when timer hits zero
  useEffect(function () {
    if (!activation || !task) return;
    if (timeUp && !lockedRef.current) {
      lockAndGrade();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp, activation, task]);

  if (loading) return <div className="card">Loading...</div>;

  if (!activation || !task || windowRemaining <= 0) {
    return (
      <div>
        <h1 className="page-title">Live Class</h1>
        <div className="card">
          <p>No live session is open right now. This page activates during your Tuesday live class.</p>
        </div>
      </div>
    );
  }

  const words = countWords(answer);

  return (
    <div>
      <h1 className="page-title">Live Class</h1>

      <div className="card live-timer-card">
        <div className="live-timer-row">
          <div>
            <div className="live-timer-label">{isLocked ? 'Time is up' : 'Time remaining'}</div>
            <div className={'live-timer' + (solveRemaining < 5 * 60 * 1000 && !isLocked ? ' live-timer-red' : '')}>
              {isLocked ? '0:00' : formatClock(solveRemaining)}
            </div>
          </div>
          <div className="live-timer-meta">
            <span className="pill">{task.session_label}</span>
            <span className="pill">{words} words</span>
            {saveState && !isLocked && <span className="pill">{saveState}</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="block-title">Translate into French</div>
        <p className="live-paragraph">{task.paragraph}</p>
      </div>

      <div className="card">
        <div className="block-title">Your translation</div>
        <textarea
          className="solve-input live-answer"
          value={answer}
          disabled={isLocked || grading}
          placeholder="Type your French translation here..."
          onChange={function (e) { setAnswer(e.target.value); }}
        />
        {!isLocked && (
          <p className="live-muted">Your work saves automatically. The box locks when the timer ends.</p>
        )}
        {grading && <p className="live-muted">Time is up. Grading your translation...</p>}
      </div>

      {isLocked && !grading && attempt && (
        <div className="card live-result">
          <div className="block-title">Result</div>
          {typeof attempt.ai_score === 'number' ? (
            <div className={'live-score' + (attempt.ai_score >= 80 ? ' live-score-green' : attempt.ai_score >= 50 ? ' live-score-amber' : ' live-score-red')}>
              {attempt.ai_score} / 100
            </div>
          ) : (
            <p className="live-muted">Your answer was saved. The score will appear once grading is available.</p>
          )}
          {attempt.mistakes && Array.isArray(attempt.mistakes) && attempt.mistakes.length > 0 && (
            <div className="live-mistakes">
              {attempt.mistakes.map(function (tag, i) {
                return <span key={i} className="live-mistake-pill">{MISTAKE_LABELS[tag] || tag}</span>;
              })}
            </div>
          )}
          {attempt.ai_feedback && <p className="live-note">{attempt.ai_feedback}</p>}
          {attempt.corrected && (
            <div className="live-corrected">
              <div className="live-corrected-label">Corrected version</div>
              <p>{attempt.corrected}</p>
            </div>
          )}
          <p className="live-muted">Words typed in 30 minutes: {attempt.words_typed}</p>
        </div>
      )}
    </div>
  );
}