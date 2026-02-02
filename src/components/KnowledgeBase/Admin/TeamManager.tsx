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
import { supabase } from '@/app/lib/supabaseClient';
import type { Team, TeamMember } from '@/types/knowledgeBase';

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
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, TeamMember[]>>({});
  const [membersLoading, setMembersLoading] = useState<string | null>(null);

  // Create team form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Add member
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const fetchTeams = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/kb/teams', { headers });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setTeams(json.data || json);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

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
      fetchTeams();
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
      fetchTeams();
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
      fetchTeams();
    } catch {
      toast.error('Failed to remove member');
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to delete the team "${teamName}"? This action cannot be undone.`)) {
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
      fetchTeams();

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
    'w-full bg-white border border-primary-light/50 rounded-lg px-3 py-2 text-sm text-gray-600 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <Loader2 className="h-8 w-8 text-gray-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white border border-primary-light/50 rounded-xl shadow-xl text-primary p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Teams</h1>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 bg-primary-light hover:bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Team
          </button>
        </div>

        {/* Create team form */}
        {showCreate && (
          <form onSubmit={handleCreateTeam} className="bg-bg-default border border-primary-light/50 rounded-lg p-5 mb-6 space-y-3">
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
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="flex items-center gap-2 bg-primary-light hover:bg-primary disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-gray-400 hover:text-primary px-4 py-2 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Teams list */}
        <div className="space-y-2">
          {teams.length === 0 ? (
            <p className="text-gray-700 text-center py-8">No teams yet. Create one to get started.</p>
          ) : (
            teams.map((team) => (
              <div key={team.id} className="bg-white border border-primary-light/50 shadow-lg rounded-lg overflow-hidden relative">
                {/* Team header */}
                <div className="flex items-center w-full bg-white relative border-b border-primary-light/10">
                  <button
                    onClick={() => toggleTeam(team.id)}
                    className="flex-1 flex items-center gap-3 px-5 py-4 hover:bg-primary-light/20 transition-colors text-left min-w-0"
                  >
                    {expandedTeam === team.id ? (
                      <ChevronDown className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-primary font-medium">{team.name}</p>
                      {team.description && (
                        <p className="text-xs text-gray-600 truncate">{team.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-primary-light whitespace-nowrap mr-2">
                      <Users className="h-3.5 w-3.5" />
                      {team.member_count ?? 0} Users
                    </div>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTeam(team.id, team.name);
                    }}
                    className="mr-3 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    title="Delete team"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Expanded: members */}
                {expandedTeam === team.id && (
                  <div className="px-5 py-4">
                    {membersLoading === team.id ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 text-gray-500 animate-spin" />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2 mb-4">
                          {(members[team.id] || []).length === 0 ? (
                            <p className="text-sm text-gray-500">No members yet</p>
                          ) : (
                            (members[team.id] || []).map((m) => (
                              <div key={m.user_id} className="flex items-center justify-between">
                                <div>
                                  <span className="text-sm text-primary font-bold">
                                    {m.display_name || m.email || m.user_id}
                                  </span>
                                  {m.email && m.display_name && (
                                    <span className="text-xs text-gray-500 ml-2">{m.email}</span>
                                  )}
                                  <span className="text-xs text-gray-500 ml-2">{m.role}</span>
                                </div>
                                <button
                                  onClick={() => handleRemoveMember(team.id, m.user_id)}
                                  className="text-gray-500 hover:text-red-400 p-1 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
                            <div className="max-h-32 overflow-y-auto bg-white rounded-lg border border-primary-light/20">
                              {getAvailableUsers(team.id).length === 0 ? (
                                <p className="text-xs text-gray-500 p-2">No matching users found</p>
                              ) : (
                                getAvailableUsers(team.id).slice(0, 10).map((u) => (
                                  <button
                                    key={u.id}
                                    onClick={() => {
                                      setSelectedUserId(u.id);
                                      setUserSearch(u.display_name || u.email);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-light/20 transition-colors ${selectedUserId === u.id ? 'bg-white text-gray-600' : 'text-gray-600'
                                      }`}
                                  >
                                    <span className="font-medium">{u.display_name || u.email}</span>
                                    {u.display_name && (
                                      <span className="text-xs text-gray-400 ml-2">{u.email}</span>
                                    )}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => handleAddMember(team.id)}
                            disabled={!selectedUserId}
                            className="flex items-center gap-1.5 bg-primary-light hover:bg-primary disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition-colors"
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
