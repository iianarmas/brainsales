'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase } from '@/app/lib/supabaseClient';
import { Save, Loader2, Send, ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmModal } from '@/components/ConfirmModal';
import { RichTextEditor } from '@/components/RichTextEditor';
import type { Team, Priority, UpdateStatus, TeamUpdate } from '@/types/knowledgeBase';

const priorityOptions: Priority[] = ['low', 'medium', 'high', 'urgent'];

export default function EditTeamUpdateRoute() {
  const { confirm: confirmModal } = useConfirmModal();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, session, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [teamUpdate, setTeamUpdate] = useState<TeamUpdate | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingUpdate, setLoadingUpdate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    if (!id || !session?.access_token) return;

    // Fetch the team update
    fetch(`/api/kb/team-updates/${id}`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        const data = json.data || json;
        setTeamUpdate(data);
        setForm({
          team_id: data.team_id || '',
          title: data.title || '',
          content: data.content || '',
          priority: data.priority || 'medium',
          requires_acknowledgment: data.requires_acknowledgment ?? false,
          status: data.status || 'draft',
          effective_until: data.effective_until ? data.effective_until.split('T')[0] : '',
        });
      })
      .catch(console.error)
      .finally(() => setLoadingUpdate(false));

    // Fetch teams
    fetch('/api/kb/teams', {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((json) => setTeams(json.data || json))
      .catch(console.error);
  }, [id, session?.access_token]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (status: UpdateStatus) => {
    if (!form.team_id || !form.title.trim()) {
      toast.error('Team and title are required');
      return;
    }
    setSaving(true);

    try {
      const res = await fetch(`/api/kb/team-updates/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          status,
          effective_until: form.effective_until || null,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update');
      }
      toast.success(status === 'published' ? 'Team update published' : 'Changes saved');
      router.push('/admin/knowledge-base');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save team update';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmModal({
      title: "Delete Team Update",
      message: "Are you sure you want to delete this team update? This will archive it.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/kb/team-updates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Team update deleted');
      router.push('/admin/knowledge-base');
    } catch {
      toast.error('Failed to delete team update');
    } finally {
      setDeleting(false);
    }
  };

  if (loading || adminLoading || loadingUpdate) return <LoadingScreen />;
  if (!user) return <LoginForm />;
  if (!isAdmin) return (
    <div className="min-h-screen bg-bg-default flex items-center justify-center text-white">
      <p>Access denied. Admin only.</p>
    </div>
  );

  if (!teamUpdate) {
    return (
      <div className="min-h-screen bg-bg-default flex items-center justify-center text-white">
        <p>Team update not found.</p>
      </div>
    );
  }

  const inputCls =
    'w-full bg-white border border-primary-light/50 rounded-lg px-3 py-2 text-sm text-500 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary';
  const labelCls = 'block text-sm font-medium text-gray-600 mb-1';

  return (
    <div className="min-h-screen bg-bg-default p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="text-primary hover:text-primary-light/80 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-primary">Edit Team Update</h1>
        </div>

        <div className="bg-white rounded-lg p-6 space-y-5 shadow-lg border border-primary-light/50">
          {/* Team selector */}
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
              className={`relative w-10 h-5 rounded-full transition-colors ${
                form.requires_acknowledgment ? 'bg-primary-light' : 'bg-gray-400'
              }`}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  form.requires_acknowledgment ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className="text-sm text-gray-500">Requires acknowledgment</span>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Current status:</span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                teamUpdate.status === 'published'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : teamUpdate.status === 'draft'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-gray-600 text-gray-300'
              }`}
            >
              {teamUpdate.status}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              onClick={() => handleSubmit('draft')}
              disabled={saving || deleting}
              className="flex items-center gap-2 bg-gray-500 hover:bg-gray-400 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save as Draft
            </button>
            <button
              onClick={() => handleSubmit('published')}
              disabled={saving || deleting}
              className="flex items-center gap-2 bg-primary-light hover:bg-primary disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publish
            </button>
            <button
              onClick={handleDelete}
              disabled={saving || deleting}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ml-auto"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
