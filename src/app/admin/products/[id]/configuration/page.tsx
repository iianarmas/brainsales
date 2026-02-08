'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { LoginForm } from '@/components/LoginForm';
import { LoadingScreen } from '@/components/LoadingScreen';
import { toast } from 'sonner';
import { ArrowLeft, Save, Plus, X, GripVertical, Calendar, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/app/lib/supabaseClient';
import * as LucideIcons from "lucide-react";
import { LucideIconPicker } from '@/components/LucideIconPicker';

interface Topic {
    id: string;
    label: string;
    icon: string;
    color: string;
    sort_order?: number;
}

export default function ProductConfigPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user, loading } = useAuth();
    const { isAdmin, loading: adminLoading } = useAdmin();

    const [painPoints, setPainPoints] = useState<string[]>([]);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [newPainPoint, setNewPainPoint] = useState('');
    const [meetingSubject, setMeetingSubject] = useState('');
    const [meetingBody, setMeetingBody] = useState('');
    const [zoomLink, setZoomLink] = useState('');
    const [saving, setSaving] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // Default pain points if none exist
    const defaultPainPoints = [
        "Manual indexing",
        "High volume",
        "Accuracy issues",
        "Staff time",
        "Backlog",
    ];

    // Default topics (for reference or reset)
    const defaultTopics: Topic[] = [
        { id: "opening", label: "Opening", icon: "Play", color: "green" },
        { id: "discovery", label: "Discovery", icon: "Search", color: "blue" },
        { id: "ehr", label: "EHR", icon: "Server", color: "cyan" },
        { id: "dms", label: "DMS", icon: "Database", color: "purple" },
        { id: "pitch", label: "Pitch", icon: "Lightbulb", color: "yellow" },
        { id: "close", label: "Close", icon: "Calendar", color: "orange" },
        { id: "end", label: "End", icon: "Flag", color: "gray" },
    ];

    useEffect(() => {
        if (user && isAdmin) {
            loadConfig();
        }
    }, [user, isAdmin, id]);

    async function loadConfig() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`/api/products/${id}/config`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });

            if (!res.ok) throw new Error('Failed to load configuration');

            const data = await res.json();

            // Set pain points
            if (data.configuration?.painPoints) {
                setPainPoints(data.configuration.painPoints);
            } else {
                setPainPoints(defaultPainPoints);
            }

            // Set meeting settings
            setMeetingSubject(data.configuration?.meetingSubject || '');
            setMeetingBody(data.configuration?.meetingBody || '');
            setZoomLink(data.configuration?.zoomLink || '');

            // Set topics
            if (data.topics && data.topics.length > 0) {
                // Ensure they are sorted by sort_order
                const sortedTopics = [...data.topics].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                setTopics(sortedTopics);
            } else {
                setTopics(defaultTopics);
            }

        } catch (err) {
            console.error(err);
            toast.error('Failed to load configuration');
        } finally {
            setInitialLoading(false);
        }
    }

    const handleSave = async () => {
        try {
            setSaving(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`/api/products/${id}/config`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    configuration: { painPoints, meetingSubject, meetingBody, zoomLink },
                    topics: topics.map((t, index) => ({ ...t, sort_order: index }))
                })
            });

            if (!res.ok) throw new Error('Failed to save');
            toast.success('Configuration saved successfully');
        } catch (err) {
            console.error(err);
            toast.error('Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    const addPainPoint = () => {
        if (!newPainPoint.trim()) return;
        if (painPoints.includes(newPainPoint.trim())) {
            toast.error('Pain point already exists');
            return;
        }
        setPainPoints([...painPoints, newPainPoint.trim()]);
        setNewPainPoint('');
    };

    const removePainPoint = (pain: string) => {
        setPainPoints(painPoints.filter(p => p !== pain));
    };

    const handleTopicChange = (index: number, field: keyof Topic, value: string) => {
        const newTopics = [...topics];
        newTopics[index] = { ...newTopics[index], [field]: value };
        setTopics(newTopics);
    };

    const addTopic = () => {
        const newTopic: Topic = {
            id: `custom_${Date.now()}`,
            label: "New Topic",
            icon: "Circle",
            color: "gray",
            sort_order: topics.length
        };
        setTopics([...topics, newTopic]);
    };

    const removeTopic = (index: number) => {
        const newTopics = [...topics];
        newTopics.splice(index, 1);
        setTopics(newTopics);
    };

    const moveTopic = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === topics.length - 1) return;

        const newTopics = [...topics];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const temp = newTopics[targetIndex];
        newTopics[targetIndex] = newTopics[index];
        newTopics[index] = temp;

        setTopics(newTopics);
    };

    if (loading || adminLoading || initialLoading) return <LoadingScreen />;
    if (!user) return <LoginForm />;
    if (!isAdmin) return <div className="p-8 text-center text-red-500">Access Denied</div>;

    return (
        <div className="min-h-screen bg-bg-default p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href={`/admin/products/${id}/content`}
                            className="text-gray-400 hover:text-primary transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-primary">Call Configuration</h1>
                            <p className="text-gray-400 text-sm">Customize call screen elements</p>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {saving ? (
                            <span className="animate-spin">⌛</span>
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Save Changes
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Pain Points Section */}
                    <div className="bg-white rounded-xl border border-primary-light/20 shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <span className="w-1 h-6 bg-amber-500 rounded-full"></span>
                            Quick Add Pain Points
                        </h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Define the pain points that appear in the 'Quick Add' section of the call context panel.
                        </p>

                        <div className="flex flex-wrap gap-2 mb-4">
                            {painPoints.map((pain) => (
                                <div key={pain} className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
                                    <span className="text-sm font-medium">{pain}</span>
                                    <button
                                        onClick={() => removePainPoint(pain)}
                                        className="text-amber-600 hover:text-amber-900 ml-1"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newPainPoint}
                                onChange={(e) => setNewPainPoint(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addPainPoint()}
                                placeholder="Add new pain point..."
                                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                            <button
                                onClick={addPainPoint}
                                disabled={!newPainPoint.trim()}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 font-medium flex items-center gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Topic Navigation Section */}
                    <div className="bg-white rounded-xl border border-primary-light/20 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
                                Topic Navigation
                            </h2>
                            <button
                                onClick={addTopic}
                                className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                Add Topic
                            </button>
                        </div>

                        <p className="text-sm text-gray-500 mb-4">
                            Customize order and appearance of top navigation tabs. Warning: changing IDs or removing topics may hide associated nodes.
                        </p>

                        <div className="space-y-3">
                            {topics.map((topic, index) => (
                                <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200 group">
                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => moveTopic(index, 'up')}
                                            disabled={index === 0}
                                            className="text-gray-400 hover:text-primary disabled:opacity-30"
                                        >
                                            <LucideIcons.ChevronUp className="h-4 w-4" />
                                        </button>
                                        <GripVertical className="h-4 w-4 text-gray-300" />
                                        <button
                                            onClick={() => moveTopic(index, 'down')}
                                            disabled={index === topics.length - 1}
                                            className="text-gray-400 hover:text-primary disabled:opacity-30"
                                        >
                                            <LucideIcons.ChevronDown className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-400 block mb-1">ID (Internal)</label>
                                            <input
                                                value={topic.id}
                                                onChange={(e) => handleTopicChange(index, 'id', e.target.value)}
                                                className="w-full text-sm bg-white px-2 py-1 rounded border border-gray-300 focus:border-primary focus:outline-none font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 block mb-1">Label</label>
                                            <input
                                                value={topic.label}
                                                onChange={(e) => handleTopicChange(index, 'label', e.target.value)}
                                                className="w-full text-sm bg-white px-2 py-1 rounded border border-gray-300 focus:border-primary focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 block mb-1">Color (Tailwind)</label>
                                            <select
                                                value={topic.color}
                                                onChange={(e) => handleTopicChange(index, 'color', e.target.value)}
                                                className="w-full text-sm bg-white px-2 py-1 rounded border border-gray-300 focus:border-primary focus:outline-none"
                                            >
                                                <option value="gray">Gray</option>
                                                <option value="blue">Blue</option>
                                                <option value="green">Green</option>
                                                <option value="red">Red</option>
                                                <option value="yellow">Yellow</option>
                                                <option value="orange">Orange</option>
                                                <option value="purple">Purple</option>
                                                <option value="cyan">Cyan</option>
                                                <option value="teal">Teal</option>
                                            </select>
                                        </div>
                                        <div className="relative">
                                            <label className="text-xs text-gray-400 block mb-1">Icon (Lucide)</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    value={topic.icon}
                                                    onChange={(e) => handleTopicChange(index, 'icon', e.target.value)}
                                                    className="w-full text-sm bg-white px-2 py-1 rounded border border-gray-300 focus:border-primary focus:outline-none"
                                                />
                                                <LucideIconPicker
                                                    value={topic.icon}
                                                    onChange={(name) => handleTopicChange(index, 'icon', name)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => removeTopic(index)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Remove Topic"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Meeting Settings Section */}
                    <div className="bg-white rounded-xl border border-primary-light/20 shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <span className="w-1 h-6 bg-green-500 rounded-full"></span>
                            Meeting Settings
                        </h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Configure the meeting template and zoom link that appear when a &quot;Meeting Scheduled&quot; outcome is selected on the call screen.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1">Subject Template</label>
                                <input
                                    type="text"
                                    value={meetingSubject}
                                    onChange={(e) => setMeetingSubject(e.target.value)}
                                    placeholder="Meeting with {prospect} - {full_name}"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1">Body Template</label>
                                <textarea
                                    value={meetingBody}
                                    onChange={(e) => setMeetingBody(e.target.value)}
                                    rows={6}
                                    placeholder="Hi {prospect}, thanks for your conversation..."
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    Available variables: {'{prospect}'}, {'{first}'}, {'{last}'}, {'{full_name}'}, {'{email}'}, {'{phone}'}, {'{role}'}, {'{phone_format}'}
                                </p>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
                                    <LinkIcon className="h-4 w-4" />
                                    Zoom Link
                                </label>
                                <input
                                    type="text"
                                    value={zoomLink}
                                    onChange={(e) => setZoomLink(e.target.value)}
                                    placeholder="https://314e.zoom.us/j/..."
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    This zoom link will be shown on the call screen when a meeting is scheduled.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
