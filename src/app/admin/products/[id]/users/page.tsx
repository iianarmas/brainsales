'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase } from '@/app/lib/supabaseClient';
import { toast } from 'sonner';
import { ArrowLeft, Plus, UserPlus, Shield, User, Loader2, X, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface ProductUser {
  product_id: string;
  user_id: string;
  role: 'user' | 'admin' | 'super_admin';
  is_default: boolean;
  joined_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface AvailableUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface Product {
  id: string;
  name: string;
  slug: string;
}

export default function ProductUsersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [product, setProduct] = useState<Product | null>(null);
  const [users, setUsers] = useState<ProductUser[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (user && isAdmin) {
      loadData();
    }
  }, [user, isAdmin, id]);

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const [productRes, usersRes] = await Promise.all([
        fetch(`/api/products/${id}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
        fetch(`/api/products/${id}/users`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
      ]);

      if (!productRes.ok || !usersRes.ok) throw new Error('Failed to load data');

      const productJson = await productRes.json();
      const usersJson = await usersRes.json();

      setProduct(productJson.product);
      setUsers(usersJson.users || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoadingData(false);
    }
  }

  async function updateRole(userId: string, newRole: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`/api/products/${id}/users`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      });

      if (!res.ok) throw new Error('Failed to update role');
      toast.success('Role updated');
      loadData();
    } catch (err) {
      toast.error('Failed to update role');
    }
  }

  async function removeUser(userId: string) {
    if (!confirm('Remove this user from the product?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`/api/products/${id}/users?user_id=${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error('Failed to remove user');
      toast.success('User removed');
      loadData();
    } catch (err) {
      toast.error('Failed to remove user');
    }
  }

  if (loading || adminLoading || loadingData) return <LoadingScreen />;
  if (!user) return <LoginForm />;
  if (!isAdmin) return (
    <div className="min-h-screen bg-bg-default flex items-center justify-center text-white">
      <p>Access denied. Admin only.</p>
    </div>
  );
  if (!product) return (
    <div className="min-h-screen bg-bg-default flex items-center justify-center text-white">
      <p>Product not found.</p>
    </div>
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Shield className="h-4 w-4 text-yellow-400" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-400" />;
      default:
        return <User className="h-4 w-4 text-gray-400" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'admin':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-bg-default p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/products"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">{product.name} Users</h1>
              <p className="text-gray-400 text-sm">Manage users and their roles</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-primary-light hover:bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Add User
          </button>
        </div>

        {/* Users List */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
          {users.length === 0 ? (
            <div className="p-8 text-center">
              <User className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No users in this product yet.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-900/50 text-left">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {users.map((u) => (
                  <tr key={u.user_id} className="hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-light/20 flex items-center justify-center text-sm font-medium text-primary-light">
                          {(u.profiles?.full_name || u.profiles?.email || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium">{u.profiles?.full_name || 'Unknown'}</p>
                          <p className="text-gray-500 text-xs">{u.profiles?.email || u.user_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => updateRole(u.user_id, e.target.value)}
                        className="bg-transparent border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-light"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(u.joined_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeUser(u.user_id)}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                        title="Remove user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add User Modal */}
        {showAddModal && (
          <AddUserModal
            productId={id}
            existingUserIds={users.map((u) => u.user_id)}
            onClose={() => setShowAddModal(false)}
            onAdded={() => {
              setShowAddModal(false);
              loadData();
            }}
          />
        )}
      </div>
    </div>
  );
}

function AddUserModal({
  productId,
  existingUserIds,
  onClose,
  onAdded,
}: {
  productId: string;
  existingUserIds: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [allUsers, setAllUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('user');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAllUsers();
  }, []);

  async function loadAllUsers() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error('Failed to load users');
      const json = await res.json();
      setAllUsers(json.users || []);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!selectedUserId) {
      toast.error('Please select a user');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`/api/products/${productId}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: selectedUserId, role: selectedRole }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add user');
      }

      toast.success('User added');
      onAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setSaving(false);
    }
  }

  const availableUsers = allUsers.filter(
    (u) => !existingUserIds.includes(u.user_id) &&
    (search === '' ||
      (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Add User to Product</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-light" />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Search Users</label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-light"
                  placeholder="Search by name or email..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Select User</label>
                <div className="max-h-48 overflow-y-auto bg-gray-900 border border-gray-700 rounded-lg">
                  {availableUsers.length === 0 ? (
                    <p className="text-gray-500 text-sm p-3">No users available</p>
                  ) : (
                    availableUsers.map((u) => (
                      <button
                        key={u.user_id}
                        onClick={() => setSelectedUserId(u.user_id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${
                          selectedUserId === u.user_id ? 'bg-primary-light/20 text-primary-light' : 'text-white'
                        }`}
                      >
                        <p className="font-medium">{u.full_name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary-light"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !selectedUserId}
                  className="flex items-center gap-2 bg-primary-light hover:bg-primary disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add User
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
