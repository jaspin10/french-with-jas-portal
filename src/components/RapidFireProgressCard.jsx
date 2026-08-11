import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const BLOCK_LABELS = {
  2: 'Statements',
  3: 'Questions',
  4: 'Debate CLB 5',
  5: 'Debate CLB 7'
};

const W = 520;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

export default function RapidFireProgressCard({ user }) {
  const [rows, setRows] = useState([]);
  const [tops, setTops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeBlock, setActiveBlock] = useState(2);

  useEffect(function () {
    let alive = true;
    async function load() {
      const { data: mine } = await supabase
        .from('rapid_fire_attempts')
        .select('duration_seconds, cycle_number, homework_content!inner(homework_id, day, block)')
        .eq('student_id', user.id)
        .eq('accepted', true)
        .eq('homework_content.day', 'tuesday');

      const { data: bench } = await supabase.rpc('rapid_fire_top_times');

      if (!alive) return;
      setRows(mine || []);
      setTops((bench || []).filter(function (t) { return t.day === 'tuesday'; }));
      setLoading(false);
    }
    load();
    return function () { alive = false; };
  }, [user.id]);

  if (loading) return null;
  if (rows.length === 0) return null;

  const blocks = [2, 3, 4, 5];

  // One point per (cycle, homework): the student's best accepted time that week
  const weekMap = {};
  rows.forEach(function (r) {
    if (r.homework_content.block !== activeBlock) return;
    const key = r.cycle_number + '-' + r.homework_content.homework_id;
    const sec = Number(r.duration_seconds);
    if (!weekMap[key] || sec < weekMap[key].seconds) {
      weekMap[key] = {
        homework_id: r.homework_content.homework_id,
        cycle_number: r.cycle_number,
        seconds: sec
      };
    }
  });
  const points = Object.values(weekMap).sort(function (a, b) {
    return a.cycle_number - b.cycle_number || a.homework_id - b.homework_id;
  });

  const benchRow = tops.find(function (t) { return t.block === activeBlock; }) || {};
  const benchLines = [
    { label: 'Top 20', value: benchRow.top20, cls: 'rfp-line-top20' },
    { label: 'Top 10', value: benchRow.top10, cls: 'rfp-line-top10' },
    { label: 'Top 5', value: benchRow.top5, cls: 'rfp-line-top5' }
  ].filter(function (b) { return b.value !== null && b.value !== undefined; });

  const allVals = points.map(function (p) { return p.seconds; })
    .concat(benchLines.map(function (b) { return Number(b.value); }));
  const maxVal = allVals.length > 0 ? Math.max.apply(null, allVals) * 1.1 : 60;
  const minVal = 0;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  function x(i) {
    if (points.length === 1) return PAD.left + plotW / 2;
    return PAD.left + (i / (points.length - 1)) * plotW;
  }
  function y(v) {
    return PAD.top + plotH - ((v - minVal) / (maxVal - minVal)) * plotH;
  }
  function fmt(s) {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  const path = points.map(function (p, i) {
    return (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(p.seconds).toFixed(1);
  }).join(' ');

  return (
    <div className="card">
      <div className="block-title">Rapid Fire — your speed vs the top students</div>

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

      {points.length === 0 && (
        <p className="rfp-empty">No completed recordings for this block yet.</p>
      )}

      {points.length > 0 && (
        <div>
          <svg viewBox={'0 0 ' + W + ' ' + H} className="rfp-chart" role="img">
            {[0.25, 0.5, 0.75, 1].map(function (f) {
              const v = minVal + (maxVal - minVal) * f;
              return (
                <g key={f}>
                  <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} className="rfp-grid" />
                  <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="rfp-axis-label">{fmt(v)}</text>
                </g>
              );
            })}

            {benchLines.map(function (b) {
              return (
                <g key={b.label}>
                  <line x1={PAD.left} y1={y(Number(b.value))} x2={W - PAD.right} y2={y(Number(b.value))} className={'rfp-bench ' + b.cls} />
                  <text x={W - PAD.right} y={y(Number(b.value)) - 4} textAnchor="end" className="rfp-bench-label">{b.label + ' ' + fmt(Number(b.value))}</text>
                </g>
              );
            })}

            <path d={path} className="rfp-line-you" fill="none" />
            {points.map(function (p, i) {
              return <circle key={i} cx={x(i)} cy={y(p.seconds)} r="4" className="rfp-dot" />;
            })}

            {points.map(function (p, i) {
              return (
                <text key={'l' + i} x={x(i)} y={H - 8} textAnchor="middle" className="rfp-axis-label">
                  W{p.homework_id}
                </text>
              );
            })}
          </svg>

          <p className="rfp-note">Your fastest passed recording each week. Dashed lines are the times to beat to enter the Top 20 / 10 / 5 (all students, all time). Lower is better.</p>
        </div>
      )}
    </div>
  );
}