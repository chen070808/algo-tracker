import { useState, useCallback } from 'react';
import { getSyncConfig, syncToCloud, saveAuth, clearAuth, type SyncResult } from '../lib/sync';

export default function SyncButton() {
  const [isAuth, setIsAuth] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState('');

  // Check auth on mount
  useState(() => {
    getSyncConfig().then((c) => setIsAuth(!!c.token));
  });

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setError('');
    try {
      const r = await syncToCloud();
      setResult(r);
    } catch (e: any) {
      setError(e.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleConnect = () => {
    // Open web console for registration/login
    window.open('http://localhost:5174/login', '_blank');
  };

  if (!isAuth) {
    return (
      <button
        onClick={handleConnect}
        className="w-full mt-2 py-1.5 px-3 bg-indigo-50 text-indigo-600 text-xs rounded-lg hover:bg-indigo-100 transition-colors"
      >
        Connect to OI Life
      </button>
    );
  }

  return (
    <div className="mt-2">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="w-full py-1.5 px-3 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {syncing ? 'Syncing...' : 'Sync to Cloud'}
      </button>
      {result && (
        <div className="mt-1 text-xs text-green-600">
          Synced: {result.new_submissions} new, Elo {result.strength_summary.overall_elo}
        </div>
      )}
      {error && (
        <div className="mt-1 text-xs text-red-500">{error}</div>
      )}
    </div>
  );
}
