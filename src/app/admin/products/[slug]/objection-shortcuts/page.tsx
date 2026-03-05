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
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { ObjectionShortcut } from '@/types/product';
import { CallNode, isNodeInFlow } from '@/data/callFlow';

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

export default function ObjectionShortcutsEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [product, setProduct] = useState<Product | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  // All objection nodes from the call flow (unfiltered)
  const [allObjectionNodes, setAllObjectionNodes] = useState<CallNode[]>([]);
  // Opening nodes for flow selector
  const [openingNodes, setOpeningNodes] = useState<CallNode[]>([]);
  // Selected flow for filtering (null = all flows)
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);

  // Current shortcut assignments
  const [assignments, setAssignments] = useState<ShortcutAssignment[]>(
    SHORTCUT_KEYS.map((key) => ({ key, node_id: null, label: null }))
  );

  // For drag and drop
  const [draggedNode, setDraggedNode] = useState<string | null>(null);

  // For script expand/collapse
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  useEffect(() => {
    if (user && isAdmin) {
      loadData();
    }
  }, [user, isAdmin, slug]);

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch product, shortcuts, and call flow in parallel
      const [productRes, shortcutsRes, callFlowRes] = await Promise.all([
        fetch(`/api/products/${slug}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
        fetch(`/api/products/${slug}/objection-shortcuts`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
        fetch('/api/scripts/callflow', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'X-Product-Id': slug,
          },
        }),
      ]);

      if (!productRes.ok) throw new Error('Failed to load product');
      const productJson = await productRes.json();
      setProduct(productJson.product);

      // Load call flow, extract objection nodes and opening nodes (flows)
      if (callFlowRes.ok) {
        const callFlow: Record<string, CallNode> = await callFlowRes.json();
        const objections = Object.values(callFlow)
          .filter((node) => node.type === 'objection')
          .sort((a, b) => a.title.localeCompare(b.title));
        setAllObjectionNodes(objections);
        const openings = Object.values(callFlow)
          .filter((node) => node.type === 'opening' && (!node.scope || node.scope === 'official'))
          .sort((a, b) => a.title.localeCompare(b.title));
        setOpeningNodes(openings);
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

      const res = await fetch(`/api/products/${slug}/objection-shortcuts`, {
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
          const node = allObjectionNodes.find((n) => n.id === nodeId);
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
    return allObjectionNodes.find((n) => n.id === nodeId)?.title || nodeId;
  };

  // Objection nodes filtered by selected flow
  const displayedObjectionNodes = allObjectionNodes.filter((n) => isNodeInFlow(n, selectedFlowId));

  // Get nodes that are NOT assigned to any key (from currently displayed ones)
  const unassignedNodes = displayedObjectionNodes.filter(
    (node) => !assignments.some((a) => a.node_id === node.id)
  );

  if (loading || adminLoading || loadingData) return <LoadingScreen />;
  if (!user) return <LoginForm />;
  if (!isAdmin) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
      <p>Access denied. Admin only.</p>
    </div>
  );
  if (!product) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
      <p>Product not found.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/products/${slug}/content`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-primary">Objection Shortcuts</h1>
              <p className="text-muted-foreground text-sm">{product.name} - Map objection handlers to number keys 0-9</p>
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

        {/* Flow selector (shown only for multi-flow products) */}
        {openingNodes.length > 1 && (
          <div className="mb-6 flex items-center gap-3">
            <label className="text-sm font-medium text-muted-foreground">Filter by Flow:</label>
            <select
              value={selectedFlowId ?? ''}
              onChange={(e) => setSelectedFlowId(e.target.value || null)}
              className="bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All Flows</option>
              {openingNodes.map((n) => (
                <option key={n.id} value={n.id}>{n.title}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Shortcut Slots */}
          <div className="bg-surface-elevated border border-border-subtle shadow-xl rounded-xl p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground mb-4">
              <Keyboard className="h-5 w-5 text-primary" />
              Keyboard Shortcuts
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Drag objection handlers from the right panel to assign them to number keys.
              Users can press these keys during a call to quickly navigate to the handler.
            </p>

            <div className="space-y-2">
              {assignments.map((assignment) => (
                <div
                  key={assignment.key}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, assignment.key)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${assignment.node_id
                      ? 'bg-surface border-primary/50'
                      : 'bg-surface/50 border-border-subtle border-dashed'
                    }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg font-bold text-primary flex-shrink-0">
                    {assignment.key}
                  </div>

                  {assignment.node_id ? (
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-foreground text-sm font-medium">
                        {getNodeTitle(assignment.node_id)}
                      </span>
                      <button
                        onClick={() => clearAssignment(assignment.key)}
                        className="text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Drop objection here or select below</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Available Objection Nodes */}
          <div className="bg-surface-elevated border border-border-subtle shadow-xl rounded-xl p-5">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Available Objections
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({unassignedNodes.length} unassigned)
              </span>
            </h2>

            {displayedObjectionNodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No objection nodes found.</p>
                <p className="text-muted-foreground text-sm">Create objection scripts in the Scripts editor.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {displayedObjectionNodes.map((node) => {
                  const assignedTo = assignments.find((a) => a.node_id === node.id);
                  const isAssigned = !!assignedTo;
                  const isExpanded = expandedNodes.has(node.id);

                  return (
                    <div
                      key={node.id}
                      className={`rounded-lg border overflow-hidden transition-colors ${isAssigned
                          ? 'bg-surface/50 border-border-subtle opacity-50'
                          : 'bg-surface border-border-subtle'
                        }`}
                    >
                      <div
                        draggable={!isAssigned}
                        onDragStart={() => handleDragStart(node.id)}
                        className={`flex items-center gap-3 p-3 ${!isAssigned ? 'cursor-grab hover:border-primary/50' : ''}`}
                      >
                        {!isAssigned && <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground text-sm font-medium truncate">{node.title}</p>
                          <p className="text-muted-foreground text-xs truncate">{node.id}</p>
                        </div>
                        {node.script && (
                          <button
                            onClick={() => toggleExpand(node.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                            title={isExpanded ? "Hide script" : "Show script"}
                          >
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                        )}
                        {isAssigned ? (
                          <span className="text-xs text-primary-foreground bg-primary px-2 py-0.5 rounded">
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
                            className="bg-input border border-border-subtle rounded px-2 py-1 text-xs text-muted-foreground focus:outline-none"
                          >
                            <option value="">Assign to...</option>
                            {SHORTCUT_KEYS.filter((k) => !assignments.find((a) => a.key === k && a.node_id))
                              .map((k) => (
                                <option key={k} value={k}>Key {k}</option>
                              ))}
                          </select>
                        )}
                      </div>
                      {isExpanded && node.script && (
                        <div className="px-4 pb-3 border-t border-border-subtle bg-muted/10">
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed border-l-2 border-primary/30 pl-3 mt-2">
                            {node.script}
                          </p>
                        </div>
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
