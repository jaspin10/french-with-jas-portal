import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const BLOCK_LABELS = {
  2: 'Statements',
  3: 'Questions',
  4: 'Debate CLB 5',
  5: 'Debate CLB 7'
};

export default function RapidFireProgressCard({ user }) {
  const [rows, setRows] = useState([]); // student accepted attempts with day/block
  const [averages, setAverages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeBlock, setActiveBlock] = useState(2);

  useEffect(function () {
    let alive = true;
    async function load() {
      const { data: mine } = await supabase
        .from('rapid_fire_attempts')
        .select('duration_seconds, cycle_number, accepted, homework_content!inner(homework_id, day, block)')
        .eq('student_id', user.id)
        .eq('accepted', true)
        .eq('homework_content.day', 'tuesday');

      const { data: avgs } = await supabase.rpc('rapid_fire_class_averages');

      if (!alive) return;
      setRows(mine || []);
      setAverages((avgs || []).filter(function (a) { return a.day === 'tuesday'; }));
      setLoading(false);
    }
    load();
    return function () { alive = false; };
  }, [user.id]);

  if (loading) return null;
  if (rows.length === 0) return null;

  const blocks = [2, 3, 4, 5];

  // Build per-block series: one point per (homework_id, cycle_number) the student completed
  const myPoints = rows
    .filter(function (r) { return r.homework_content.block === activeBlock; })
    .map(function (r) {
      return {
        homework_id: r.homework_content.homework_id,
        cycle_number: r.cycle_number,
        seconds: Number(r.duration_seconds)
      };
    })
    .sort(function (a, b) {
      return a.cycle_number - b.cycle_number || a.homework_id - b.homework_id;
    });

  function classAvgFor(p) {
    const hit = averages.find(function (a) {
      return a.block === activeBlock &&
        a.homework_id === p.homework_id &&
        a.cycle_number === p.cycle_number;
    });
    return hit ? Number(hit.avg_seconds) : null;
  }

  const maxVal = Math.max.apply(null, myPoints.map(function (p) {
    const a = classAvgFor(p);
    return Math.max(p.seconds, a || 0);
  }));

  function fmt(s) {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  return (
    <div className="card">
      <div className="block-title">Rapid Fire — your speed vs the class</div>

      <div className="rf-tabs" style={{ marginBottom: 12 }}>
        {blocks.map(function (b) {
          function pick() { setActiveBlock(b); }
          return (
            <button className="day-tab" key={b} onClick={pick} disabled={activeBlock === b}>
              {BLOCK_LABELS[b] || 'Block ' + b}
            </button>
          );
        })}
      </div>

      {myPoints.length === 0 && (
        <p className="rfp-empty">No completed recordings for this block yet.</p>
      )}

      {myPoints.map(function (p, i) {
        const avg = classAvgFor(p);
        const myPct = maxVal > 0 ? Math.max(6, (p.seconds / maxVal) * 100) : 0;
        const avgPct = avg && maxVal > 0 ? Math.max(6, (avg / maxVal) * 100) : 0;
        return (
          <div className="rfp-week" key={i}>
            <div className="rfp-week-label">Week {p.homework_id} · cycle {p.cycle_number}</div>
            <div className="rfp-bar-row">
              <span className="rfp-bar-tag">You</span>
              <div className="rfp-bar rfp-bar-you" style={{ width: myPct + '%' }}></div>
              <span className="rfp-bar-val">{fmt(p.seconds)}</span>
            </div>
            {avg !== null && (
              <div className="rfp-bar-row">
                <span className="rfp-bar-tag">Class</span>
                <div className="rfp-bar rfp-bar-class" style={{ width: avgPct + '%' }}></div>
                <span className="rfp-bar-val">{fmt(avg)}</span>
              </div>
            )}
          </div>
        );
      })}

      <p className="rfp-note">Class average = the 20 fastest accepted recordings that week. Shorter bar is better.</p>
    </div>
  );
}