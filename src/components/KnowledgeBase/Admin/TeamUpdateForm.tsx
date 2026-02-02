'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, Send, Globe, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/app/lib/supabaseClient';
import { RichTextEditor } from '@/components/RichTextEditor';
import type { Team, Priority, UpdateStatus } from '@/types/knowledgeBase';


const priorityOptions: Priority[] = ['low', 'medium', 'high', 'urgent'];

type BroadcastMode = 'team' | 'all';

export function TeamUpdateForm() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [saving, setSaving] = useState(false);

  const [broadcastMode, setBroadcastMode] = useState<BroadcastMode>('team');

  const [form, setForm] = useState({
    team_id: '',
    title: '',
    content: '',
    priority: 'medium' as Priority,
    requires_acknowledgment: false,
    status: 'draft' as UpdateStatus,
    effective_until: '',
  });

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const teamsRes = await fetch('/api/kb/teams', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });

        if (teamsRes.ok) {
          const teamsJson = await teamsRes.json();
          setTeams(teamsJson.data || teamsJson);
        }
      } catch { /* silent */ }
    }
    loadData();
  }, []);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (status: UpdateStatus) => {
    // Validate based on broadcast mode
    if (broadcastMode === 'team' && !form.team_id) {
      toast.error('Please select a team');
      return;
    }
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);

    const payload: Record<string, unknown> = {
      title: form.title,
      content: form.content,
      priority: form.priority,
      requires_acknowledgment: form.requires_acknowledgment,
      status,
      effective_until: form.effective_until || undefined,
    };

    // Set fields based on broadcast mode
    if (broadcastMode === 'team') {
      payload.team_id = form.team_id;
      payload.is_broadcast = false;
    } else if (broadcastMode === 'all') {
      payload.is_broadcast = true;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch('/api/kb/team-updates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');

      const modeLabel = broadcastMode === 'all' ? 'Broadcast' : 'Team update';
      toast.success(status === 'published' ? `${modeLabel} published` : 'Draft saved');

      // Reset
      setForm({
        team_id: '',
        title: '',
        content: '',
        priority: 'medium',
        requires_acknowledgment: false,
        status: 'draft',
        effective_until: '',
      });
    } catch {
      toast.error('Failed to save update');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full bg-white border border-primary-light/20 rounded-lg px-3 py-2 text-sm text-gray-500 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary';
  const labelCls = 'block text-sm font-medium text-gray-300 mb-1';

  const modeOptions: { value: BroadcastMode; label: string; icon: typeof Users; description: string }[] = [
    { value: 'team', label: 'Team', icon: Users, description: 'Send to a specific team' },
    { value: 'all', label: 'Broadcast', icon: Globe, description: 'Send to all users' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-white border border-primary-light/50 shadow-xl rounded-xl text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-primary mb-6">New Team Update</h1>

        <div className="space-y-5">
          {/* Broadcast Mode Selector */}
          <div>
            <label className={labelCls}>Send To</label>
            <div className="grid grid-cols-2 gap-2">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setBroadcastMode(option.value)}
                  className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${broadcastMode === option.value
                    ? 'border-primary-light bg-primary-light/10'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                >
                  <option.icon className={`h-5 w-5 mb-1 ${broadcastMode === option.value ? 'text-primary' : 'text-gray-400'
                    }`} />
                  <span className={`text-sm font-medium ${broadcastMode === option.value ? 'text-primary' : 'text-gray-600'
                    }`}>
                    {option.label}
                  </span>
                  <span className="text-xs text-gray-400 mt-0.5 text-center">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Team selector (shown when mode is 'team') */}
          {broadcastMode === 'team' && (
            <div>
              <label className={labelCls}>Team</label>
              <select
                value={form.team_id}
                onChange={(e) => setField('team_id', e.target.value)}
                className={inputCls}
              >
                <option value="">Select team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Broadcast warning (shown when mode is 'all') */}
          {broadcastMode === 'all' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Broadcast mode:</strong> This update will be sent to all users in the system.
              </p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className={labelCls}>Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              className={inputCls}
              placeholder="Update title"
            />
          </div>

          {/* Content */}
          <div>
            <label className={labelCls}>Content</label>
            <RichTextEditor
              content={form.content}
              onChange={(html) => setField('content', html)}
              placeholder="Write update content..."
            />
          </div>

          {/* Priority */}
          <div>
            <label className={labelCls}>Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setField('priority', e.target.value as Priority)}
              className={inputCls}
            >
              {priorityOptions.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Effective Until */}
          <div>
            <label className={labelCls}>Effective Until (optional)</label>
            <input
              type="date"
              value={form.effective_until}
              onChange={(e) => setField('effective_until', e.target.value)}
              className={inputCls}
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty if this update should be followed indefinitely
            </p>
          </div>

          {/* Requires acknowledgment */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setField('requires_acknowledgment', !form.requires_acknowledgment)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.requires_acknowledgment ? 'bg-primary-light' : 'bg-gray-400'
                }`}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${form.requires_acknowledgment ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
              />
            </button>
            <span className="text-sm text-gray-500">Requires acknowledgment</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => handleSubmit('draft')}
              disabled={saving}
              className="flex items-center gap-2 bg-gray-500 hover:bg-gray-400 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Draft
            </button>
            <button
              onClick={() => handleSubmit('published')}
              disabled={saving}
              className="flex items-center gap-2 bg-primary-light hover:bg-primary disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
