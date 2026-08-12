import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ClassPage({ profile }) {
  const [links, setLinks] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(function () {
    let active = true;

    async function load() {
      const { data: linkRows } = await supabase
        .from('class_links')
        .select('*')
        .order('level', { ascending: true });

      const { data: recRows } = await supabase
        .from('recordings')
        .select('*, homeworks(theme)')
        .order('recorded_on', { ascending: false });

      if (!active) return;
      setLinks(linkRows || []);
      setRecordings(recRows || []);
      setLoading(false);
    }

    load();
    return function () { active = false; };
  }, [profile.level]);

  function openMeet(url) {
    window.open(url, '_blank');
  }

  function recordingsForLevel(level) {
    return recordings.filter(function (r) { return r.level === level; });
  }

  if (loading) {
    return <div className="card">Loading...</div>;
  }

  return (
    <div>
      {links.length === 0 ? (
        <div className="card">No class links are set yet.</div>
      ) : (
        links.map(function (l) {
          const levelRecs = recordingsForLevel(l.level);
          return (
            <div className="card" key={l.id}>
              <div className="block-title">Level {l.level} live class</div>
              <button
                className="sub-btn"
                onClick={function () { openMeet(l.meet_url); }}
              >
                Join Google Meet
              </button>
              <div className="cl-timetable">
                {(l.sessions || []).map(function (s, i) {
                  return (
                    <div className="cl-session" key={i}>
                      <div className="cl-session-label">{s.label}</div>
                      <div className="cl-session-time">{s.days} - {s.time}</div>
                    </div>
                  );
                })}
              </div>
              <div className="cl-tz">All times in Vancouver time (America/Vancouver)</div>

              <div className="block-title cl-rec-heading">Recordings</div>
              {levelRecs.length === 0 ? (
                <div>No recordings yet. They will appear here after each class.</div>
              ) : (
                <div>
                  {levelRecs.map(function (r) {
                    return (
                      <div className="cl-recording" key={r.id}>
                        <div>
                          <div className="cl-rec-title">{r.title}</div>
                          <div className="cl-rec-meta">
                            {r.homeworks ? r.homeworks.theme : ''}
                            {r.homeworks ? ' - ' : ''}
                            {r.recorded_on}
                          </div>
                        </div>
                        <div className="cl-rec-actions">
                          <a className="reveal-btn" href={r.drive_url} target="_blank" rel="noreferrer">Watch</a>
                          {r.notes_url ? (
                            <a className="reveal-btn" href={r.notes_url} target="_blank" rel="noreferrer">Notes</a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}