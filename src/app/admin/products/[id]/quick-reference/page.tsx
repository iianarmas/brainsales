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
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Star,
  Target,
  BarChart3,
  Lightbulb,
} from 'lucide-react';
import Link from 'next/link';
import { QuickReferenceData, QuickReferenceCompetitor, QuickReferenceMetric } from '@/types/product';

interface Product {
  id: string;
  name: string;
  slug: string;
}

export default function QuickReferenceEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [product, setProduct] = useState<Product | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState<QuickReferenceData>({
    differentiators: [],
    competitors: [],
    metrics: [],
    tips: [],
  });

  const [expandedSections, setExpandedSections] = useState({
    differentiators: true,
    competitors: true,
    metrics: true,
    tips: true,
  });

  useEffect(() => {
    if (user && isAdmin) {
      loadData();
    }
  }, [user, isAdmin, id]);

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const [productRes, quickRefRes] = await Promise.all([
        fetch(`/api/products/${id}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
        fetch(`/api/products/${id}/quick-reference`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }),
      ]);

      if (!productRes.ok) throw new Error('Failed to load product');
      const productJson = await productRes.json();
      setProduct(productJson.product);

      if (quickRefRes.ok) {
        const quickRefJson = await quickRefRes.json();
        setData({
          differentiators: quickRefJson.differentiators || [],
          competitors: Array.isArray(quickRefJson.competitors) ? quickRefJson.competitors : [],
          metrics: (quickRefJson.metrics || []).map((m: any, i: number) => ({ ...m, id: m.id || `metric-${i}` })),
          tips: quickRefJson.tips || [],
        });
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

      const res = await fetch(`/api/products/${id}/quick-reference`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to save');
      toast.success('Quick reference saved');
    } catch (err) {
      toast.error('Failed to save quick reference');
    } finally {
      setSaving(false);
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections({ ...expandedSections, [section]: !expandedSections[section] });
  };

  const reorder = (list: any[], startIndex: number, endIndex: number) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  };

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
      <div className="max-w-4xl mx-auto">
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
              <h1 className="text-2xl font-bold text-primary">Quick Reference Editor</h1>
              <p className="text-gray-400 text-sm">{product.name}</p>
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

        <div className="space-y-4">
          {/* Differentiators Section */}
          <CollapsibleSection
            title="Differentiators"
            icon={Star}
            iconColor="text-yellow-400"
            expanded={expandedSections.differentiators}
            onToggle={() => toggleSection('differentiators')}
            count={data.differentiators.length}
          >
            <DifferentiatorsEditor
              items={data.differentiators}
              onChange={(items) => setData({ ...data, differentiators: items })}
              onReorder={(startIndex, endIndex) =>
                setData({ ...data, differentiators: reorder(data.differentiators, startIndex, endIndex) })
              }
            />
          </CollapsibleSection>

          {/* Competitors Section */}
          <CollapsibleSection
            title="Competitors"
            icon={Target}
            iconColor="text-red-400"
            expanded={expandedSections.competitors}
            onToggle={() => toggleSection('competitors')}
            count={data.competitors.length}
          >
            <CompetitorsEditor
              competitors={data.competitors}
              onChange={(competitors) => setData({ ...data, competitors })}
              onReorder={(startIndex, endIndex) =>
                setData({ ...data, competitors: reorder(data.competitors, startIndex, endIndex) })
              }
            />
          </CollapsibleSection>

          {/* Metrics Section */}
          <CollapsibleSection
            title="Key Metrics"
            icon={BarChart3}
            iconColor="text-blue-400"
            expanded={expandedSections.metrics}
            onToggle={() => toggleSection('metrics')}
            count={data.metrics.length}
          >
            <MetricsEditor
              metrics={data.metrics}
              onChange={(metrics) => setData({ ...data, metrics })}
              onReorder={(startIndex, endIndex) =>
                setData({ ...data, metrics: reorder(data.metrics, startIndex, endIndex) })
              }
            />
          </CollapsibleSection>

          {/* Tips Section */}
          <CollapsibleSection
            title="Pro Tips"
            icon={Lightbulb}
            iconColor="text-green-400"
            expanded={expandedSections.tips}
            onToggle={() => toggleSection('tips')}
            count={data.tips.length}
          >
            <TipsEditor
              items={data.tips}
              onChange={(items) => setData({ ...data, tips: items })}
              onReorder={(startIndex, endIndex) =>
                setData({ ...data, tips: reorder(data.tips, startIndex, endIndex) })
              }
            />
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}

// Collapsible Section Component
function CollapsibleSection({
  title,
  icon: Icon,
  iconColor,
  expanded,
  onToggle,
  count,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  expanded: boolean;
  onToggle: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-primary-light/20 hover:border-primary-light/50 rounded-xl overflow-hidden shadow-lg">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          <span className="font-medium text-gray-600">{title}</span>
          <span className="text-xs text-white bg-primary-light px-2 py-0.5 rounded-full">{count}</span>
        </div>
        {expanded ? (
          <ChevronDown className="h-5 w-5 text-gray-400 hover:text-primary" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400 hover:text-primary" />
        )}
      </button>
      {expanded && <div className="p-4 pt-0">{children}</div>}
    </div>
  );
}

// Helper for Drag and Drop
function useDnD(onReorder: (startIndex: number, endIndex: number) => void) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
  };
  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    onReorder(draggedIndex, index);
    setDraggedIndex(null);
  };

  return { handleDragStart, handleDragOver, handleDrop, draggedIndex };
}

// Differentiators Editor
function DifferentiatorsEditor({
  items,
  onChange,
  onReorder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  onReorder: (startIndex: number, endIndex: number) => void;
}) {
  const { handleDragStart, handleDragOver, handleDrop, draggedIndex } = useDnD(onReorder);
  const addItem = () => onChange([...items, '']);
  const updateItem = (index: number, value: string) => {
    const updated = [...items];
    updated[index] = value;
    onChange(updated);
  };
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));

  return (
    <div className="space-y-2 mt-4">
      {items.map((item, index) => (
        <div
          key={index}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          className={`flex items-center gap-2 p-1 rounded-lg transition-colors ${draggedIndex === index ? 'opacity-50' : ''}`}
        >
          <GripVertical className="h-4 w-4 text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0" />
          <input
            type="text"
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            className="flex-1 bg-white border border-primary-light/50 rounded-lg px-3 py-2 text-sm text-gray-600 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-light"
            placeholder="Enter differentiator..."
          />
          <button
            onClick={() => removeItem(index)}
            className="text-gray-500 hover:text-red-400 transition-colors p-1"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="flex items-center gap-2 text-primary-light hover:text-primary text-sm mt-2 transition-colors px-1"
      >
        <Plus className="h-4 w-4" />
        Add Differentiator
      </button>
    </div>
  );
}

// Competitors Editor
function CompetitorsEditor({
  competitors,
  onChange,
  onReorder,
}: {
  competitors: QuickReferenceCompetitor[];
  onChange: (competitors: QuickReferenceCompetitor[]) => void;
  onReorder: (startIndex: number, endIndex: number) => void;
}) {
  const { handleDragStart, handleDragOver, handleDrop, draggedIndex } = useDnD(onReorder);

  const addCompetitor = () => {
    const id = `comp_${Date.now()}`;
    onChange([
      ...competitors,
      { id, name: '', strengths: [], limitations: [], advantage: '' },
    ]);
  };

  const updateCompetitor = (index: number, field: keyof QuickReferenceCompetitor, value: any) => {
    const updated = [...competitors];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeCompetitor = (index: number) => {
    const updated = [...competitors];
    updated.splice(index, 1);
    onChange(updated);
  };

  return (
    <div className="space-y-4 mt-4">
      {competitors.map((competitor, index) => (
        <div
          key={competitor.id}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          className={`bg-white border border-primary-light/20 hover:border-primary-light/50 rounded-lg p-4 shadow-sm transition-all ${draggedIndex === index ? 'opacity-50' : ''}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-1">
              <GripVertical className="h-4 w-4 text-gray-600 cursor-grab active:cursor-grabbing" />
              <input
                type="text"
                value={competitor.name}
                onChange={(e) => updateCompetitor(index, 'name', e.target.value)}
                className="bg-transparent text-primary font-bold text-lg focus:outline-none border-b border-transparent hover:border-gray-200 focus:border-primary-light flex-1"
                placeholder="Competitor Name"
              />
            </div>
            <button
              onClick={() => removeCompetitor(index)}
              className="text-gray-400 hover:text-red-500 transition-colors p-1"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <ListInput
              label="Strengths"
              items={competitor.strengths}
              onChange={(items) => updateCompetitor(index, 'strengths', items)}
              placeholder="Add strength..."
            />
            <ListInput
              label="Limitations"
              items={competitor.limitations}
              onChange={(items) => updateCompetitor(index, 'limitations', items)}
              placeholder="Add limitation..."
            />
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Our Advantage</label>
              <textarea
                value={competitor.advantage}
                onChange={(e) => updateCompetitor(index, 'advantage', e.target.value)}
                rows={3}
                className="w-full bg-white border border-primary-light/50 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-light resize-none placeholder-gray-400"
                placeholder="How we win against them..."
              />
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={addCompetitor}
        className="w-full flex items-center justify-center gap-2 bg-white border-2 border-dashed border-primary-light/30 hover:border-primary-light/60 text-primary-light hover:text-primary py-4 rounded-xl transition-all font-medium"
      >
        <Plus className="h-5 w-5" />
        Add New Competitor
      </button>
    </div>
  );
}

// Sub-component for Strengths/Limitations list editing
function ListInput({
  label,
  items,
  onChange,
  placeholder
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const addItem = () => onChange([...items, ""]);
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));
  const updateItem = (index: number, val: string) => {
    const updated = [...items];
    updated[index] = val;
    onChange(updated);
  };

  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">{label}</label>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => updateItem(idx, e.target.value)}
              className="flex-1 bg-white border border-primary-light/40 rounded px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-light"
              placeholder={placeholder}
            />
            <button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-400">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          onClick={addItem}
          className="flex items-center gap-1.5 text-xs text-primary-light hover:text-primary transition-colors font-medium mt-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add {label.toLowerCase().slice(0, -1)}
        </button>
      </div>
    </div>
  );
}

// X icon for list removal
function X({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

// Metrics Editor
function MetricsEditor({
  metrics,
  onChange,
  onReorder,
}: {
  metrics: QuickReferenceMetric[];
  onChange: (metrics: QuickReferenceMetric[]) => void;
  onReorder: (startIndex: number, endIndex: number) => void;
}) {
  const { handleDragStart, handleDragOver, handleDrop, draggedIndex } = useDnD(onReorder);
  const addMetric = () => onChange([...metrics, { id: `metric_${Date.now()}`, value: '', label: '' }]);
  const updateMetric = (index: number, field: keyof QuickReferenceMetric, value: string) => {
    const updated = [...metrics];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };
  const removeMetric = (index: number) => onChange(metrics.filter((_, i) => i !== index));

  return (
    <div className="space-y-2 mt-4">
      {metrics.map((metric, index) => (
        <div
          key={metric.id || index}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          className={`flex items-center gap-2 p-1 rounded-lg transition-colors ${draggedIndex === index ? 'opacity-50' : ''}`}
        >
          <GripVertical className="h-4 w-4 text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0" />
          <input
            type="text"
            value={metric.value}
            onChange={(e) => updateMetric(index, 'value', e.target.value)}
            className="w-24 bg-white border border-primary-light/50 rounded-lg px-3 py-2 text-sm text-gray-600 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary text-center font-semibold"
            placeholder="70%"
          />
          <input
            type="text"
            value={metric.label}
            onChange={(e) => updateMetric(index, 'label', e.target.value)}
            className="flex-1 bg-white border border-primary-light/50 rounded-lg px-3 py-2 text-sm text-gray-600 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Metric label..."
          />
          <button
            onClick={() => removeMetric(index)}
            className="text-gray-500 hover:text-red-400 transition-colors p-1"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        onClick={addMetric}
        className="flex items-center gap-2 text-primary-light hover:text-primary text-sm mt-2 transition-colors px-1"
      >
        <Plus className="h-4 w-4" />
        Add Metric
      </button>
    </div>
  );
}

// Tips Editor
function TipsEditor({
  items,
  onChange,
  onReorder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  onReorder: (startIndex: number, endIndex: number) => void;
}) {
  const { handleDragStart, handleDragOver, handleDrop, draggedIndex } = useDnD(onReorder);
  const addItem = () => onChange([...items, '']);
  const updateItem = (index: number, value: string) => {
    const updated = [...items];
    updated[index] = value;
    onChange(updated);
  };
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));

  return (
    <div className="space-y-2 mt-4">
      {items.map((item, index) => (
        <div
          key={index}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          className={`flex items-center gap-2 p-1 rounded-lg transition-colors ${draggedIndex === index ? 'opacity-50' : ''}`}
        >
          <GripVertical className="h-4 w-4 text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0" />
          <input
            type="text"
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            className="flex-1 bg-white border border-primary-light/50 rounded-lg px-3 py-2 text-sm text-gray-600 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Enter tip..."
          />
          <button
            onClick={() => removeItem(index)}
            className="text-gray-500 hover:text-red-400 transition-colors p-1"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="flex items-center gap-2 text-primary-light hover:text-primary text-sm mt-2 transition-colors px-1"
      >
        <Plus className="h-4 w-4" />
        Add Tip
      </button>
    </div>
  );
}
