import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ClassPage({ profile }) {
  const [link, setLink] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(function () {
    let active = true;

    async function load() {
      const { data: linkRows } = await supabase
        .from('class_links')
        .select('*')
        .eq('level', profile.level)
        .limit(1);

      const { data: recRows } = await supabase
        .from('recordings')
        .select('*, homeworks(theme)')
        .eq('level', profile.level)
        .order('recorded_on', { ascending: false });

      if (!active) return;
      setLink(linkRows && linkRows.length > 0 ? linkRows[0] : null);
      setRecordings(recRows || []);
      setLoading(false);
    }

    load();
    return function () { active = false; };
  }, [profile.level]);

  function openMeet() {
    if (link) window.open(link.meet_url, '_blank');
  }

  if (loading) {
    return <div className="card">Loading...</div>;
  }

  return (
    <div>
      <div className="card">
        <div className="block-title">Live class</div>
        {link ? (
          <div>
            <button className="sub-btn" onClick={openMeet}>
              Join Google Meet
            </button>
            <div className="cl-timetable">
              {(link.sessions || []).map(function (s, i) {
                return (
                  <div className="cl-session" key={i}>
                    <div className="cl-session-label">{s.label}</div>
                    <div className="cl-session-time">{s.days} - {s.time}</div>
                  </div>
                );
              })}
            </div>
            <div className="cl-tz">All times in Vancouver time (America/Vancouver)</div>
          </div>
        ) : (
          <div>No class link is set for your level yet.</div>
        )}
      </div>

      <div className="card">
        <div className="block-title">Class recordings</div>
        {recordings.length === 0 ? (
          <div>No recordings yet. They will appear here after each class.</div>
        ) : (
          <div>
            {recordings.map(function (r) {
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
                  <a className="reveal-btn" href={r.drive_url} target="_blank" rel="noreferrer">Watch</a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}