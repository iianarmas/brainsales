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
    competitors: {},
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
          competitors: quickRefJson.competitors || {},
          metrics: quickRefJson.metrics || [],
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
              <h1 className="text-2xl font-bold text-white">Quick Reference Editor</h1>
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
            />
          </CollapsibleSection>

          {/* Competitors Section */}
          <CollapsibleSection
            title="Competitors"
            icon={Target}
            iconColor="text-red-400"
            expanded={expandedSections.competitors}
            onToggle={() => toggleSection('competitors')}
            count={Object.keys(data.competitors).length}
          >
            <CompetitorsEditor
              competitors={data.competitors}
              onChange={(competitors) => setData({ ...data, competitors })}
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
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          <span className="font-medium text-white">{title}</span>
          <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">{count}</span>
        </div>
        {expanded ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {expanded && <div className="p-4 pt-0 border-t border-gray-700">{children}</div>}
    </div>
  );
}

// Differentiators Editor
function DifferentiatorsEditor({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
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
        <div key={index} className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-gray-600 cursor-grab" />
          <input
            type="text"
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-light"
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
        className="flex items-center gap-2 text-primary-light hover:text-primary text-sm mt-2 transition-colors"
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
}: {
  competitors: Record<string, QuickReferenceCompetitor>;
  onChange: (competitors: Record<string, QuickReferenceCompetitor>) => void;
}) {
  const [newKey, setNewKey] = useState('');

  const addCompetitor = () => {
    if (!newKey.trim()) return;
    const key = newKey.toLowerCase().replace(/\s+/g, '_');
    if (competitors[key]) {
      toast.error('Competitor already exists');
      return;
    }
    onChange({
      ...competitors,
      [key]: { name: newKey, strengths: [], limitations: [], advantage: '' },
    });
    setNewKey('');
  };

  const updateCompetitor = (key: string, field: keyof QuickReferenceCompetitor, value: string | string[]) => {
    onChange({
      ...competitors,
      [key]: { ...competitors[key], [field]: value },
    });
  };

  const removeCompetitor = (key: string) => {
    const updated = { ...competitors };
    delete updated[key];
    onChange(updated);
  };

  return (
    <div className="space-y-4 mt-4">
      {Object.entries(competitors).map(([key, competitor]) => (
        <div key={key} className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <input
              type="text"
              value={competitor.name}
              onChange={(e) => updateCompetitor(key, 'name', e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none border-b border-transparent hover:border-gray-600 focus:border-primary-light"
              placeholder="Competitor name"
            />
            <button
              onClick={() => removeCompetitor(key)}
              className="text-gray-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Strengths (comma-separated)</label>
              <input
                type="text"
                value={competitor.strengths.join(', ')}
                onChange={(e) => updateCompetitor(key, 'strengths', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-light"
                placeholder="e.g., Enterprise-proven, Good support"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Limitations (comma-separated)</label>
              <input
                type="text"
                value={competitor.limitations.join(', ')}
                onChange={(e) => updateCompetitor(key, 'limitations', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-light"
                placeholder="e.g., No AI, Manual processes"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Our Advantage</label>
              <input
                type="text"
                value={competitor.advantage}
                onChange={(e) => updateCompetitor(key, 'advantage', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-light"
                placeholder="How we beat this competitor..."
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCompetitor()}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-light"
          placeholder="New competitor name..."
        />
        <button
          onClick={addCompetitor}
          disabled={!newKey.trim()}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </div>
  );
}

// Metrics Editor
function MetricsEditor({
  metrics,
  onChange,
}: {
  metrics: QuickReferenceMetric[];
  onChange: (metrics: QuickReferenceMetric[]) => void;
}) {
  const addMetric = () => onChange([...metrics, { value: '', label: '' }]);
  const updateMetric = (index: number, field: keyof QuickReferenceMetric, value: string) => {
    const updated = [...metrics];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };
  const removeMetric = (index: number) => onChange(metrics.filter((_, i) => i !== index));

  return (
    <div className="space-y-2 mt-4">
      {metrics.map((metric, index) => (
        <div key={index} className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-gray-600 cursor-grab" />
          <input
            type="text"
            value={metric.value}
            onChange={(e) => updateMetric(index, 'value', e.target.value)}
            className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-light text-center font-semibold"
            placeholder="70%"
          />
          <input
            type="text"
            value={metric.label}
            onChange={(e) => updateMetric(index, 'label', e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-light"
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
        className="flex items-center gap-2 text-primary-light hover:text-primary text-sm mt-2 transition-colors"
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
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
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
        <div key={index} className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-gray-600 cursor-grab" />
          <input
            type="text"
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-light"
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
        className="flex items-center gap-2 text-primary-light hover:text-primary text-sm mt-2 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add Tip
      </button>
    </div>
  );
}
