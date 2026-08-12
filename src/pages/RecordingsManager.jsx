import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import SyncRecordingsButton from '../components/SyncRecordingsButton';

export default function RecordingsManager() {
  const [recordings, setRecordings] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [level, setLevel] = useState('2');
  const [title, setTitle] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [recordedOn, setRecordedOn] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [editId, setEditId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(function () {
    load();
  }, []);

  async function load() {
    const { data: cyc } = await supabase
      .from('global_cycle')
      .select('*, homeworks(theme)')
      .eq('id', 1)
      .single();

    const { data: recs } = await supabase
      .from('recordings')
      .select('*, homeworks(theme)')
      .order('recorded_on', { ascending: false });

    setCycle(cyc);
    setRecordings(recs || []);
  }

  async function addRecording() {
    if (!title.trim() || !driveUrl.trim() || !recordedOn) {
      setMsg('Please fill in title, Drive link and date.');
      return;
    }
    setSaving(true);
    setMsg('');

    const { error } = await supabase.from('recordings').insert({
      level: Number(level),
      homework_id: cycle ? cycle.current_homework_id : null,
      cycle_number: cycle ? cycle.cycle_number : null,
      title: title.trim(),
      drive_url: driveUrl.trim(),
      recorded_on: recordedOn
    });

    setSaving(false);
    if (error) {
      setMsg('Error: ' + error.message);
      return;
    }
    setTitle('');
    setDriveUrl('');
    setRecordedOn('');
    setMsg('Recording added.');
    load();
  }

  async function deleteRecording(id) {
    if (!window.confirm('Delete this recording link?')) return;
    await supabase.from('recordings').delete().eq('id', id);
    load();
  }

  function startEdit(r) {
    setEditId(r.id);
    setEditTitle(r.title || '');
    setEditNotes(r.notes_url || '');
  }

  function cancelEdit() {
    setEditId(null);
    setEditTitle('');
    setEditNotes('');
  }

  async function saveEdit() {
    if (!editTitle.trim()) return;
    setEditSaving(true);
    const { error } = await supabase.from('recordings').update({
      title: editTitle.trim(),
      notes_url: editNotes.trim() || null
    }).eq('id', editId);
    setEditSaving(false);
    if (error) {
      setMsg('Edit error: ' + error.message);
      return;
    }
    cancelEdit();
    load();
  }

  return (
    <div>
      <div className="rm-header">
        <h2>Recordings</h2>
        <SyncRecordingsButton onDone={load} />
      </div>

      <div className="card">
        <div className="block-title">Add a recording</div>
        {cycle ? (
          <div className="cl-rec-meta" style={{ marginBottom: 10 }}>
            Will be tagged with current week: {cycle.homeworks ? cycle.homeworks.theme : ''} (cycle {cycle.cycle_number})
          </div>
        ) : null}
        <div className="rm-form">
          <select
            className="solve-input"
            value={level}
            onChange={function (e) { setLevel(e.target.value); }}
          >
            <option value="2">Level 2</option>
            <option value="4">Level 4</option>
          </select>
          <input
            className="solve-input"
            placeholder="Title (e.g. Monday class)"
            value={title}
            onChange={function (e) { setTitle(e.target.value); }}
          />
          <input
            className="solve-input"
            placeholder="Google Drive share link"
            value={driveUrl}
            onChange={function (e) { setDriveUrl(e.target.value); }}
          />
          <input
            className="solve-input"
            type="date"
            value={recordedOn}
            onChange={function (e) { setRecordedOn(e.target.value); }}
          />
          <button className="sub-btn" onClick={addRecording} disabled={saving}>
            {saving ? 'Saving...' : 'Add recording'}
          </button>
        </div>
        {msg ? <div className="cl-rec-meta" style={{ marginTop: 8 }}>{msg}</div> : null}
      </div>

      <div className="card">
        <div className="block-title">All recordings</div>
        {recordings.length === 0 ? (
          <div>No recordings yet.</div>
        ) : (
          <div>
            {recordings.map(function (r) {
              if (editId === r.id) {
                return (
                  <div className="cl-recording rm-edit-row" key={r.id}>
                    <div className="rm-edit-fields">
                      <input
                        className="solve-input"
                        value={editTitle}
                        onChange={function (e) { setEditTitle(e.target.value); }}
                        placeholder="Title"
                      />
                      <input
                        className="solve-input"
                        value={editNotes}
                        onChange={function (e) { setEditNotes(e.target.value); }}
                        placeholder="Notes link (Slides or Doc)"
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="reveal-btn" onClick={saveEdit} disabled={editSaving}>
                        {editSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button className="reveal-btn" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                );
              }
              return (
                <div className="cl-recording" key={r.id}>
                  <div>
                    <div className="cl-rec-title">L{r.level} - {r.title}</div>
                    <div className="cl-rec-meta">
                      {r.homeworks ? r.homeworks.theme : ''} - {r.recorded_on}
                      {r.session_slot ? ' - auto (' + r.session_slot + ')' : ''}
                      {r.notes_url ? ' - has notes' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a className="reveal-btn" href={r.drive_url} target="_blank" rel="noreferrer">Open</a>
                    {r.notes_url ? (
                      <a className="reveal-btn" href={r.notes_url} target="_blank" rel="noreferrer">Notes</a>
                    ) : null}
                    <button className="reveal-btn" onClick={function () { startEdit(r); }}>Edit</button>
                    <button className="reveal-btn" onClick={function () { deleteRecording(r.id); }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}