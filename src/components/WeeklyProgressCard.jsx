import React, { useEffect, useState } from 'react';
import { getWeeklyCompletion } from '../lib/weeklyCompletion';

export default function WeeklyProgressCard(props) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(function () {
    let alive = true;
    async function load() {
      const res = await getWeeklyCompletion(props.profile);
      if (alive) {
        setData(res);
        setLoading(false);
      }
    }
    load();
    return function () { alive = false; };
  }, [props.profile.id]);

  if (loading) {
    return (
      <div className="card wp-card">
        <div className="wp-title">This week</div>
        <div className="wp-theme">Loading...</div>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="card wp-card">
        <div className="wp-title">This week</div>
        <div className="wp-theme">{data && data.theme ? data.theme : 'No homework loaded'}</div>
        <div className="wp-meta">No tasks available yet</div>
      </div>
    );
  }

  return (
    <div className="card wp-card">
      <div className="wp-title">This week</div>
      <div className="wp-theme">{data.theme}</div>
      <div className="wp-bar">
        <div className="wp-bar-fill" style={{ width: data.percent + '%' }}></div>
      </div>
      <div className="wp-meta">
        <span className="wp-pct">{data.percent}%</span>
        <span>{data.done} / {data.total} tasks done</span>
      </div>
    </div>
  );
}
