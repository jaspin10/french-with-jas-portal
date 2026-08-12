import { useState } from 'react';

const FN_URL = 'https://jtzazvkshizmuhezuxwl.supabase.co/functions/v1/sync-recordings';


export default function SyncRecordingsButton({ onDone }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  async function runSync() {
    setBusy(true);
    setResult('');
    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      const data = await res.json();
      if (data.ok) {
        setResult('Imported ' + data.imported.length + ' - synced ' + data.files_synced + ' files');
        if (onDone) onDone();
      } else {
        setResult('Error: ' + (data.error || 'unknown'));
      }
    } catch (e) {
      setResult('Error: ' + String(e));
    }
    setBusy(false);
  }

  return (
    <span className="sync-rec-wrap">
      <button className="reveal-btn" onClick={runSync} disabled={busy}>
        {busy ? 'Syncing...' : 'Sync now'}
      </button>
      {result ? <span className="cl-rec-meta sync-rec-msg">{result}</span> : null}
    </span>
  );
}