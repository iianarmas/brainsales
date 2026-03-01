import { useState, useEffect } from 'react';
import { Check, Clock, Send, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/app/lib/supabaseClient';
import { LoadingScreen } from '@/components/LoadingScreen';

interface AckUser {
  user_id: string;
  email?: string;
  display_name?: string;
  acknowledged_at?: string;
}

interface AcknowledgmentTrackerProps {
  updateId: string;
  updateType?: 'kb' | 'team';
}

export function AcknowledgmentTracker({ updateId, updateType = 'kb' }: AcknowledgmentTrackerProps) {
  const [acknowledged, setAcknowledged] = useState<AckUser[]>([]);
  const [pending, setPending] = useState<AckUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const baseUrl = updateType === 'kb' ? '/api/kb/updates' : '/api/kb/team-updates';
        const res = await fetch(`${baseUrl}/${updateId}/acknowledgments`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setAcknowledged(data.acknowledged || []);
        setPending(data.pending || []);
      } catch (err) {
        console.error('Failed to fetch acknowledgments:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [updateId, updateType]);

  const handleSendReminder = async () => {
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expired');
        return;
      }

      const baseUrl = updateType === 'kb' ? '/api/kb/updates' : '/api/kb/team-updates';
      const res = await fetch(`${baseUrl}/${updateId}/remind`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      toast.success(data.message || 'Reminder sent to pending users');
    } catch {
      toast.error('Failed to send reminders');
    } finally {
      setSending(false);
    }
  };

  const total = acknowledged.length + pending.length;

  if (loading) {
    return <LoadingScreen fullScreen={false} message="Loading..." />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">
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
      <div className="h-2 bg-surface rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-primary rounded-full transition-all shadow-sm"
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
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {acknowledged.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No acknowledgments yet</p>
            ) : (
              acknowledged.map((u) => (
                <div key={u.user_id} className="flex flex-col text-sm border-b border-border-subtle pb-2">
                  <span className="text-foreground font-semibold">{u.display_name || u.email || u.user_id}</span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {u.acknowledged_at && new Date(u.acknowledged_at).toLocaleString()}
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
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {pending.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Everyone has acknowledged</p>
            ) : (
              pending.map((u) => (
                <div key={u.user_id} className="text-sm text-foreground/80 border-b border-border-subtle pb-2 font-medium">
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
