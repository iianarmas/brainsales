'use client';

import { useState, useEffect } from 'react';
import { Check, Clock, Send, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface AckUser {
  user_id: string;
  email?: string;
  display_name?: string;
  acknowledged_at?: string;
}

interface AcknowledgmentTrackerProps {
  updateId: string;
}

export function AcknowledgmentTracker({ updateId }: AcknowledgmentTrackerProps) {
  const [acknowledged, setAcknowledged] = useState<AckUser[]>([]);
  const [pending, setPending] = useState<AckUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`/api/kb/updates/${updateId}/acknowledgments`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setAcknowledged(data.acknowledged || []);
        setPending(data.pending || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [updateId]);

  const handleSendReminder = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/kb/updates/${updateId}/remind`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Reminder sent to pending users');
    } catch {
      toast.error('Failed to send reminders');
    } finally {
      setSending(false);
    }
  };

  const total = acknowledged.length + pending.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
      {/* Summary */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-gray-400" />
          <span className="text-white font-semibold">
            {acknowledged.length}/{total} acknowledged
          </span>
        </div>
        {pending.length > 0 && (
          <button
            onClick={handleSendReminder}
            disabled={sending}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send Reminder
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: total > 0 ? `${(acknowledged.length / total) * 100}%` : '0%' }}
        />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-6">
        {/* Acknowledged */}
        <div>
          <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            Acknowledged ({acknowledged.length})
          </h3>
          <div className="space-y-2">
            {acknowledged.length === 0 ? (
              <p className="text-xs text-gray-500">No acknowledgments yet</p>
            ) : (
              acknowledged.map((u) => (
                <div key={u.user_id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{u.display_name || u.email || u.user_id}</span>
                  <span className="text-xs text-gray-500">
                    {u.acknowledged_at && new Date(u.acknowledged_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending */}
        <div>
          <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Pending ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.length === 0 ? (
              <p className="text-xs text-gray-500">Everyone has acknowledged</p>
            ) : (
              pending.map((u) => (
                <div key={u.user_id} className="text-sm text-gray-400">
                  {u.display_name || u.email || u.user_id}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
