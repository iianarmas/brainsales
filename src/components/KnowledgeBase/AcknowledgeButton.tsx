'use client';

import { useState } from 'react';
import { Check, Square } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/app/lib/supabaseClient';

interface AcknowledgeButtonProps {
  updateId: string;
  isAcknowledged: boolean;
  acknowledgedAt?: string;
  onAcknowledge?: () => void;
}

export function AcknowledgeButton({
  updateId,
  isAcknowledged,
  acknowledgedAt,
  onAcknowledge,
}: AcknowledgeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [acknowledged, setAcknowledged] = useState(isAcknowledged);
  const [timestamp, setTimestamp] = useState(acknowledgedAt);

  const handleAcknowledge = async () => {
    if (acknowledged || loading) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`/api/kb/updates/${updateId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to acknowledge');
      setAcknowledged(true);
      setTimestamp(new Date().toISOString());
      onAcknowledge?.();
      toast.success('Update acknowledged');
    } catch {
      toast.error('Failed to acknowledge update');
    } finally {
      setLoading(false);
    }
  };

  if (acknowledged) {
    return (
      <div className="flex items-center gap-2 text-primary text-sm">
        <Check className="h-4 w-4" />
        <span>
          Acknowledged
          {timestamp && (
            <span className="text-gray-500 ml-1">
              {new Date(timestamp).toLocaleDateString()}
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={handleAcknowledge}
      disabled={loading}
      className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
    >
      <Square className="h-4 w-4" />
      <span>{loading ? 'Acknowledging...' : "I've read and understood this update"}</span>
    </button>
  );
}
