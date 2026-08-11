import { useState } from 'react';

const SYNC_URL = 'https://jtzazvkshizmuhezuxwl.supabase.co/functions/v1/smart-handler';

export default function SyncMeetButton() {
  const [state, setState] = useState('idle'); // idle | syncing | ok | error

  function handleClick() {
    setState('syncing');
    fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.ok) {
          setState('ok');
        } else {
          setState('error');
        }
        setTimeout(function () { setState('idle'); }, 4000);
      })
      .catch(function () {
        setState('error');
        setTimeout(function () { setState('idle'); }, 4000);
      });
  }

  let label = 'Sync Meet guests';
  if (state === 'syncing') label = 'Syncing...';
  if (state === 'ok') label = 'Synced!';
  if (state === 'error') label = 'Sync failed';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'syncing'}
      style={{
        background: state === 'error' ? 'var(--danger, #e74c3c)' : 'var(--primary)',
        color: '#fff',
        border: 'none',
        borderRadius: '10px',
        padding: '8px 14px',
        cursor: state === 'syncing' ? 'wait' : 'pointer',
        fontSize: '14px',
        opacity: state === 'syncing' ? 0.7 : 1,
      }}
    >
      {label}
    </button>
  );
}