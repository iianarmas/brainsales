'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase } from '@/app/lib/supabaseClient';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Save,
  Loader2,
  Keyboard,
  AlertCircle,
  X,
  GripVertical,
} from 'lucide-react';
import Link from 'next/link';
import { ObjectionShortcut } from '@/types/product';
import { CallNode } from '@/data/callFlow';

interface Product {
  id: string;
  name: string;
  slug: string;
}

interface ShortcutAssignment {
  key: string;
  node_id: string | null;
  label: string | null;
}

const SHORTCUT_KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function ObjectionShortcutsEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [product, setProduct] = useState<Product | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  // All objection nodes from the call flow
  const [objectionNodes, setObjectionNodes] = useState<CallNode[]>([]);

  // Current shortcut assignments
  const [assignments, setAssignments] = useState<ShortcutAssignment[]>(
    SHORTCUT_KEYS.map((key) => ({ key, node_id: null, label: null }))
  );

  // For drag and drop
  const [draggedNode, setDraggedNode] = useState<string | null>(null);

  useEffect(() => {
    if (user && isAdmin) {
      loadData();
    }
  }, [user, isAdmin, id]);

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch product, shortcuts, and call flow in parallel
      const [productRes, shortcutsRes, callFlowRes] = await Promise.all([
        fetch(`/api/products/${id}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
        fetch(`/api/products/${id}/objection-shortcuts`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
        fetch('/api/scripts/callflow', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'X-Product-Id': id,
          },
        }),
      ]);

      if (!productRes.ok) throw new Error('Failed to load product');
      const productJson = await productRes.json();
      setProduct(productJson.product);

      // Load call flow and filter to objection nodes
      if (callFlowRes.ok) {
        const callFlow: Record<string, CallNode> = await callFlowRes.json();
        const objections = Object.values(callFlow)
          .filter((node) => node.type === 'objection')
          .sort((a, b) => a.title.localeCompare(b.title));
        setObjectionNodes(objections);
      }

      // Load current shortcuts
      if (shortcutsRes.ok) {
        const shortcutsJson = await shortcutsRes.json();
        const shortcuts: ObjectionShortcut[] = shortcutsJson.shortcuts || [];

        // Map shortcuts to assignments
        const newAssignments: ShortcutAssignment[] = SHORTCUT_KEYS.map((key) => {
          const existing = shortcuts.find((s) => s.shortcut_key === key);
          return {
            key,
            node_id: existing?.node_id || null,
            label: existing?.label || null,
          };
        });
        setAssignments(newAssignments);
      }
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoadingData(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Convert assignments to API format
      const shortcuts = assignments
        .filter((a) => a.node_id)
        .map((a) => ({
          node_id: a.node_id,
          shortcut_key: a.key,
          label: a.label,
        }));

      const res = await fetch(`/api/products/${id}/objection-shortcuts`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shortcuts }),
      });

      if (!res.ok) throw new Error('Failed to save');
      toast.success('Shortcuts saved');
    } catch (err) {
      toast.error('Failed to save shortcuts');
    } finally {
      setSaving(false);
    }
  }

  const assignNode = (key: string, nodeId: string | null) => {
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.key === key) {
          const node = objectionNodes.find((n) => n.id === nodeId);
          return { ...a, node_id: nodeId, label: node?.title || null };
        }
        return a;
      })
    );
  };

  const clearAssignment = (key: string) => {
    assignNode(key, null);
  };

  const handleDragStart = (nodeId: string) => {
    setDraggedNode(nodeId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    if (draggedNode) {
      assignNode(key, draggedNode);
      setDraggedNode(null);
    }
  };

  const getNodeTitle = (nodeId: string | null) => {
    if (!nodeId) return null;
    return objectionNodes.find((n) => n.id === nodeId)?.title || nodeId;
  };

  // Get nodes that are NOT assigned to any key
  const unassignedNodes = objectionNodes.filter(
    (node) => !assignments.some((a) => a.node_id === node.id)
  );

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

  return (
    <div className="min-h-screen bg-bg-default p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/products/${id}/content`}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Objection Shortcuts</h1>
              <p className="text-gray-400 text-sm">{product.name} - Map objection handlers to number keys 0-9</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-primary-light hover:bg-primary disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Shortcut Slots */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
              <Keyboard className="h-5 w-5 text-primary-light" />
              Keyboard Shortcuts
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Drag objection handlers from the right panel to assign them to number keys.
              Users can press these keys during a call to quickly navigate to the handler.
            </p>

            <div className="space-y-2">
              {assignments.map((assignment) => (
                <div
                  key={assignment.key}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, assignment.key)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    assignment.node_id
                      ? 'bg-gray-900/50 border-gray-600'
                      : 'bg-gray-900/20 border-gray-700 border-dashed'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-light/20 flex items-center justify-center text-lg font-bold text-primary-light flex-shrink-0">
                    {assignment.key}
                  </div>

                  {assignment.node_id ? (
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-white text-sm font-medium">
                        {getNodeTitle(assignment.node_id)}
                      </span>
                      <button
                        onClick={() => clearAssignment(assignment.key)}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-500 text-sm">Drop objection here or select below</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Available Objection Nodes */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">
              Available Objections
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({unassignedNodes.length} unassigned)
              </span>
            </h2>

            {objectionNodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-10 w-10 text-gray-600 mb-3" />
                <p className="text-gray-400">No objection nodes found.</p>
                <p className="text-gray-500 text-sm">Create objection scripts in the Scripts editor.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {objectionNodes.map((node) => {
                  const assignedTo = assignments.find((a) => a.node_id === node.id);
                  const isAssigned = !!assignedTo;

                  return (
                    <div
                      key={node.id}
                      draggable={!isAssigned}
                      onDragStart={() => handleDragStart(node.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isAssigned
                          ? 'bg-gray-900/20 border-gray-700 opacity-50'
                          : 'bg-gray-900/50 border-gray-600 cursor-grab hover:border-primary-light/50'
                      }`}
                    >
                      {!isAssigned && <GripVertical className="h-4 w-4 text-gray-600 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{node.title}</p>
                        <p className="text-gray-500 text-xs truncate">{node.id}</p>
                      </div>
                      {isAssigned ? (
                        <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">
                          Key {assignedTo.key}
                        </span>
                      ) : (
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              assignNode(e.target.value, node.id);
                            }
                          }}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-400 focus:outline-none"
                        >
                          <option value="">Assign to...</option>
                          {SHORTCUT_KEYS.filter((k) => !assignments.find((a) => a.key === k && a.node_id))
                            .map((k) => (
                              <option key={k} value={k}>Key {k}</option>
                            ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
