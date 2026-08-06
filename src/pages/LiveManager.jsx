import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const THREE_HOURS = 3 * 60 * 60 * 1000;

function formatRemaining(ms) {
  if (ms <= 0) return '0:00';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
}

export default function LiveManager() {
  const [cycle, setCycle] = useState(null);
  const [homework, setHomework] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activations, setActivations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [formLevel, setFormLevel] = useState('2');
  const [formSession, setFormSession] = useState('morning');
  const [formParagraph, setFormParagraph] = useState('');

  const [quickLevel, setQuickLevel] = useState('2');
  const [quickSession, setQuickSession] = useState('morning');
  const [quickParagraph, setQuickParagraph] = useState('');

  useEffect(function () {
    loadAll();
    const t = setInterval(function () { setNow(Date.now()); }, 30000);
    return function () { clearInterval(t); };
  }, []);

  async function loadAll() {
    setLoading(true);
    const { data: gc } = await supabase.from('global_cycle').select('*').eq('id', 1).single();
    if (!gc) { setLoading(false); return; }
    setCycle(gc);
    const { data: hw } = await supabase.from('homeworks').select('id, theme, tense').eq('id', gc.current_homework_id).single();
    setHomework(hw || null);
    const { data: taskRows } = await supabase
      .from('live_tasks')
      .select('*')
      .eq('homework_id', gc.current_homework_id)
      .order('level')
      .order('session_label');
    const list = taskRows || [];
    setTasks(list);
    if (list.length > 0) {
      const ids = list.map(function (t) { return t.id; });
      const { data: actRows } = await supabase
        .from('live_activations')
        .select('*')
        .in('task_id', ids)
        .eq('cycle_number', gc.cycle_number)
        .order('activated_at', { ascending: false });
      setActivations(actRows || []);
    } else {
      setActivations([]);
    }
    setLoading(false);
  }

  function activeActivationFor(taskId) {
    for (let i = 0; i < activations.length; i++) {
      const a = activations[i];
      if (a.task_id !== taskId) continue;
      if (a.ended_early) continue;
      const elapsed = now - new Date(a.activated_at).getTime();
      if (elapsed < THREE_HOURS) return a;
    }
    return null;
  }

  function alreadyRanFor(taskId) {
    for (let i = 0; i < activations.length; i++) {
      if (activations[i].task_id === taskId) return true;
    }
    return false;
  }

  async function saveTask() {
    if (!formParagraph.trim() || !cycle) return;
    setBusy(true);
    const { error } = await supabase.from('live_tasks').insert({
      homework_id: cycle.current_homework_id,
      level: Number(formLevel),
      session_label: formSession,
      paragraph: formParagraph.trim()
    });
    setBusy(false);
    if (error) { alert('Save failed: ' + error.message); return; }
    setFormParagraph('');
    loadAll();
  }

  async function activateTask(task) {
    if (!cycle) return;
    const running = activeActivationFor(task.id);
    if (running) { alert('This task is already live.'); return; }
    if (!window.confirm('Activate "' + task.session_label + '" for Level ' + task.level + '? The 30-minute clock starts for everyone the moment students begin — the page opens now and closes in 3 hours.')) return;
    setBusy(true);
    const { error } = await supabase.from('live_activations').insert({
      task_id: task.id,
      cycle_number: cycle.cycle_number
    });
    setBusy(false);
    if (error) { alert('Activation failed: ' + error.message); return; }
    loadAll();
  }

  async function endEarly(activation) {
    if (!window.confirm('End this live session now? Students will no longer see the page.')) return;
    setBusy(true);
    const { error } = await supabase.from('live_activations').update({ ended_early: true }).eq('id', activation.id);
    setBusy(false);
    if (error) { alert('Failed: ' + error.message); return; }
    loadAll();
  }

  async function quickActivate() {
    if (!quickParagraph.trim() || !cycle) return;
    setBusy(true);
    const { data: existing } = await supabase
      .from('live_tasks')
      .select('id')
      .eq('homework_id', cycle.current_homework_id)
      .eq('level', Number(quickLevel))
      .eq('session_label', quickSession)
      .maybeSingle();
    let taskId = existing ? existing.id : null;
    if (taskId) {
      const { error: upErr } = await supabase.from('live_tasks').update({ paragraph: quickParagraph.trim() }).eq('id', taskId);
      if (upErr) { setBusy(false); alert('Save failed: ' + upErr.message); return; }
    } else {
      const { data: inserted, error: insErr } = await supabase.from('live_tasks').insert({
        homework_id: cycle.current_homework_id,
        level: Number(quickLevel),
        session_label: quickSession,
        paragraph: quickParagraph.trim()
      }).select('id').single();
      if (insErr) { setBusy(false); alert('Save failed: ' + insErr.message); return; }
      taskId = inserted.id;
    }
    const { error: actErr } = await supabase.from('live_activations').insert({
      task_id: taskId,
      cycle_number: cycle.cycle_number
    });
    setBusy(false);
    if (actErr) { alert('Activation failed: ' + actErr.message); return; }
    setQuickParagraph('');
    loadAll();
  }

  if (loading) return <div className="card">Loading...</div>;

  return (
    <div>
      <h1 className="page-title">Live Class Manager</h1>

      {homework && (
        <div className="card live-week-banner">
          <strong>Week {homework.id}</strong> — {homework.theme} ({homework.tense}) · cycle {cycle.cycle_number}
        </div>
      )}

      <div className="card">
        <div className="block-title">Prepared tasks — this week</div>
        {tasks.length === 0 && <p className="live-muted">No tasks saved for this week yet.</p>}
        {tasks.map(function (task) {
          const running = activeActivationFor(task.id);
          const ran = alreadyRanFor(task.id);
          return (
            <div key={task.id} className="live-task-row">
              <div className="live-task-head">
                <span className="pill">Level {task.level}</span>
                <span className="pill">{task.session_label}</span>
                {running && (
                  <span className="pill live-pill-active">LIVE · {formatRemaining(THREE_HOURS - (now - new Date(running.activated_at).getTime()))} left</span>
                )}
                {!running && ran && <span className="pill">already ran this cycle</span>}
              </div>
              <p className="live-task-para">{task.paragraph}</p>
              <div className="live-task-actions">
                {!running && (
                  <button className="sub-btn" disabled={busy} onClick={function () { activateTask(task); }}>Activate</button>
                )}
                {running && (
                  <button className="sub-btn live-btn-danger" disabled={busy} onClick={function () { endEarly(running); }}>End session now</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="block-title">Add a task for this week</div>
        <div className="live-form-row">
          <select className="solve-input" value={formLevel} onChange={function (e) { setFormLevel(e.target.value); }}>
            <option value="2">Level 2</option>
            <option value="4">Level 4</option>
          </select>
          <select className="solve-input" value={formSession} onChange={function (e) { setFormSession(e.target.value); }}>
            <option value="morning">morning</option>
            <option value="evening">evening</option>
          </select>
        </div>
        <textarea
          className="solve-input live-textarea"
          placeholder="Paste the English paragraph"
          value={formParagraph}
          onChange={function (e) { setFormParagraph(e.target.value); }}
        />
        <button className="sub-btn" disabled={busy || !formParagraph.trim()} onClick={saveTask}>Save task</button>
      </div>

      <div className="card">
        <div className="block-title">Quick paste and activate now</div>
        <p className="live-muted">Saves the paragraph to this week (overwriting any saved one for that level and session) and goes live immediately.</p>
        <div className="live-form-row">
          <select className="solve-input" value={quickLevel} onChange={function (e) { setQuickLevel(e.target.value); }}>
            <option value="2">Level 2</option>
            <option value="4">Level 4</option>
          </select>
          <select className="solve-input" value={quickSession} onChange={function (e) { setQuickSession(e.target.value); }}>
            <option value="morning">morning</option>
            <option value="evening">evening</option>
          </select>
        </div>
        <textarea
          className="solve-input live-textarea"
          placeholder="Paste the English paragraph"
          value={quickParagraph}
          onChange={function (e) { setQuickParagraph(e.target.value); }}
        />
        <button className="sub-btn" disabled={busy || !quickParagraph.trim()} onClick={quickActivate}>Activate now</button>
      </div>
    </div>
  );
}