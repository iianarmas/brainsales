'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Users,
  Trash2,
  UserPlus,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmModal } from '@/components/ConfirmModal';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase } from '@/app/lib/supabaseClient';
import type { Team, TeamMember } from '@/types/knowledgeBase';
import { useAdminData } from '@/hooks/useAdminData';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return {};
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

interface AppUser {
  id: string;
  email: string;
  display_name?: string;
}

export function TeamManager() {
  const { confirm: confirmModal } = useConfirmModal();
  const { teams, loadingTeams: loading, fetchTeams } = useAdminData();
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, TeamMember[]>>({});
  const [membersLoading, setMembersLoading] = useState<string | null>(null);

  // ... (rest of the state)
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Add member
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/users', { headers });
      if (!res.ok) return;
      const json = await res.json();
      setAllUsers(json.data || json || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchTeams();
    fetchUsers();
  }, [fetchTeams, fetchUsers]);

  const toggleTeam = async (teamId: string) => {
    if (expandedTeam === teamId) {
      setExpandedTeam(null);
      return;
    }
    setExpandedTeam(teamId);
    if (!members[teamId]) {
      setMembersLoading(teamId);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/kb/teams/${teamId}/members`, { headers });
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        setMembers((prev) => ({ ...prev, [teamId]: json.data || json }));
      } catch {
        toast.error('Failed to load members');
      } finally {
        setMembersLoading(null);
      }
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/kb/teams', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newName, description: newDesc || null }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Team created');
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      fetchTeams(true);
    } catch {
      toast.error('Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  const handleAddMember = async (teamId: string) => {
    if (!selectedUserId) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/kb/teams/${teamId}/members`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: selectedUserId }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed');
      }
      toast.success('Member added');
      setSelectedUserId('');
      setUserSearch('');
      // Refresh members
      const refreshRes = await fetch(`/api/kb/teams/${teamId}/members`, { headers });
      if (refreshRes.ok) {
        const json = await refreshRes.json();
        setMembers((prev) => ({ ...prev, [teamId]: json.data || json }));
      }
      fetchTeams(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add member');
    }
  };

  const handleRemoveMember = async (teamId: string, userId: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/kb/teams/${teamId}/members?user_id=${userId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error('Failed');
      setMembers((prev) => ({
        ...prev,
        [teamId]: (prev[teamId] || []).filter((m) => m.user_id !== userId),
      }));
      toast.success('Member removed');
      fetchTeams(true);
    } catch {
      toast.error('Failed to remove member');
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    const confirmed = await confirmModal({
      title: "Delete Team",
      message: `Are you sure you want to delete the team "${teamName}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/kb/teams?id=${teamId}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete team');
      }

      toast.success('Team deleted successfully');
      fetchTeams(true);

      // Close expanded team if it was the deleted one
      if (expandedTeam === teamId) {
        setExpandedTeam(null);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete team');
    }
  };

  // Filter users not already in this team
  const getAvailableUsers = (teamId: string) => {
    const teamMembers = members[teamId] || [];
    const memberIds = new Set(teamMembers.map((m) => m.user_id));
    return allUsers.filter((u) => {
      if (memberIds.has(u.id)) return false;
      if (!userSearch) return true;
      const search = userSearch.toLowerCase();
      return (
        u.email.toLowerCase().includes(search) ||
        (u.display_name && u.display_name.toLowerCase().includes(search))
      );
    });
  };

  const inputCls =
    'w-full bg-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all';

  if (loading) {
    return <LoadingScreen fullScreen={false} message="Loading teams..." />;
  }

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-foreground">Teams</h1>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            New Team
          </button>
        </div>

        {/* Create team form */}
        {showCreate && (
          <form onSubmit={handleCreateTeam} className="bg-surface border border-border-subtle rounded-xl p-6 mb-8 space-y-4 shadow-xl">
            <div className="space-y-4">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={inputCls}
                placeholder="Team name"
              />
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className={inputCls}
                placeholder="Description (optional)"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="flex items-center gap-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-md active:scale-95"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-muted-foreground hover:text-foreground hover:bg-surface-active px-5 py-2 text-sm transition-all rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Teams list */}
        <div className="space-y-2">
          {teams.length === 0 ? (
            <p className="text-muted-foreground text-center py-12 bg-surface/30 rounded-xl border border-dashed border-border-subtle">No teams yet. Create one to get started.</p>
          ) : (
            teams.map((team) => (
              <div key={team.id} className="bg-surface-elevated border border-border-subtle shadow-xl rounded-xl overflow-hidden relative group">
                {/* Team header */}
                <div className="flex items-center w-full bg-surface-elevated relative border-b border-border-subtle">
                  <button
                    onClick={() => toggleTeam(team.id)}
                    className="flex-1 flex items-center gap-4 px-5 py-5 hover:bg-surface transition-colors text-left min-w-0"
                  >
                    {expandedTeam === team.id ? (
                      <ChevronDown className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-semibold">{team.name}</p>
                      {team.description && (
                        <p className="text-xs text-muted-foreground truncate font-medium mt-0.5">{team.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-surface px-2.5 py-1 rounded-full whitespace-nowrap mr-2 border border-border-subtle">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      {team.member_count ?? 0} Users
                    </div>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTeam(team.id, team.name);
                    }}
                    className="mr-3 p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                    title="Delete team"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Expanded: members */}
                {expandedTeam === team.id && (
                  <div className="px-5 py-4">
                    {membersLoading === team.id ? (
                      <LoadingScreen fullScreen={false} message="Loading members..." />
                    ) : (
                      <>
                        <div className="space-y-3 mb-6 bg-surface p-4 rounded-xl border border-border-subtle">
                          {(members[team.id] || []).length === 0 ? (
                            <p className="text-sm text-muted-foreground italic text-center py-2">No members yet</p>
                          ) : (
                            (members[team.id] || []).map((m) => (
                              <div key={m.user_id} className="flex items-center justify-between group/member py-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-foreground font-semibold">
                                    {m.display_name || m.email || m.user_id}
                                  </span>
                                  {m.role && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase font-bold tracking-wider">
                                      {m.role}
                                    </span>
                                  )}
                                  {m.email && m.display_name && (
                                    <span className="text-xs text-muted-foreground ml-1">{m.email}</span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleRemoveMember(team.id, m.user_id)}
                                  className="text-muted-foreground hover:text-red-500 p-1.5 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover/member:opacity-100"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Add member - user selector */}
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            className={inputCls}
                            placeholder="Search users by name or email..."
                          />
                          {userSearch && (
                            <div className="max-h-48 overflow-y-auto bg-surface-elevated rounded-xl border border-border-subtle shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                              {getAvailableUsers(team.id).length === 0 ? (
                                <p className="text-xs text-muted-foreground p-4 text-center">No matching users found</p>
                              ) : (
                                getAvailableUsers(team.id).slice(0, 10).map((u) => (
                                  <button
                                    key={u.id}
                                    onClick={() => {
                                      setSelectedUserId(u.id);
                                      setUserSearch(u.display_name || u.email);
                                    }}
                                    className={`w-full text-left px-4 py-3 text-sm hover:bg-primary/10 transition-colors border-b last:border-0 border-border-subtle ${selectedUserId === u.id ? 'bg-primary/20 text-foreground font-semibold' : 'text-foreground'
                                      }`}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-semibold">{u.display_name || u.email}</span>
                                      {u.display_name && (
                                        <span className="text-xs text-muted-foreground">{u.email}</span>
                                      )}
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => handleAddMember(team.id)}
                            disabled={!selectedUserId}
                            className="flex items-center gap-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-primary/20 active:scale-95"
                          >
                            <UserPlus className="h-4 w-4" />
                            Add Member
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
