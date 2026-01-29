'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { CreateUpdatePayload } from '@/types/knowledgeBase';

interface ImportItem extends CreateUpdatePayload {
  _valid?: boolean;
  _error?: string;
}

export function BulkImportForm() {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<{ index: number; error: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateItem = (item: unknown, index: number): ImportItem | null => {
    if (!item || typeof item !== 'object') return null;
    const obj = item as Record<string, unknown>;
    if (!obj.title || typeof obj.title !== 'string') {
      return { ...obj, _valid: false, _error: `Item ${index + 1}: missing title` } as ImportItem;
    }
    if (!obj.category_slug || typeof obj.category_slug !== 'string') {
      return { ...obj, _valid: false, _error: `Item ${index + 1}: missing category_slug` } as ImportItem;
    }
    if (!obj.content || typeof obj.content !== 'string') {
      return { ...obj, _valid: false, _error: `Item ${index + 1}: missing content` } as ImportItem;
    }
    return { ...obj, _valid: true } as ImportItem;
  };

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) {
      toast.error('Please upload a .json file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!Array.isArray(data)) {
          toast.error('JSON must be an array of update objects');
          return;
        }
        const validated = data.map((item, i) => validateItem(item, i)).filter(Boolean) as ImportItem[];
        setItems(validated);
        setErrors([]);
        setProgress(0);
      } catch {
        toast.error('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleImport = async () => {
    const validItems = items.filter((i) => i._valid);
    if (validItems.length === 0) {
      toast.error('No valid items to import');
      return;
    }
    setImporting(true);
    setErrors([]);
    const newErrors: { index: number; error: string }[] = [];

    for (let i = 0; i < validItems.length; i++) {
      try {
        const { _valid, _error, ...payload } = validItems[i];
        const res = await fetch('/api/kb/updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      } catch (err) {
        newErrors.push({ index: i, error: String(err) });
      }
      setProgress(Math.round(((i + 1) / validItems.length) * 100));
    }

    setErrors(newErrors);
    setImporting(false);
    if (newErrors.length === 0) {
      toast.success(`Successfully imported ${validItems.length} updates`);
      setItems([]);
    } else {
      toast.error(`${newErrors.length} items failed to import`);
    }
  };

  const validCount = items.filter((i) => i._valid).length;
  const invalidCount = items.filter((i) => !i._valid).length;

  return (
    <div className="h-full overflow-y-auto bg-gray-900 text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Bulk Import Updates</h1>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
          }`}
        >
          <Upload className="h-10 w-10 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-300 font-medium mb-1">
            Drop a .json file here or click to browse
          </p>
          <p className="text-xs text-gray-500">
            File should contain an array of CreateUpdatePayload objects
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        {/* Preview */}
        {items.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-400">
                  <FileJson className="inline h-4 w-4 mr-1" />
                  {items.length} items loaded
                </span>
                {validCount > 0 && (
                  <span className="text-emerald-400">
                    <CheckCircle2 className="inline h-4 w-4 mr-1" />
                    {validCount} valid
                  </span>
                )}
                {invalidCount > 0 && (
                  <span className="text-red-400">
                    <AlertCircle className="inline h-4 w-4 mr-1" />
                    {invalidCount} invalid
                  </span>
                )}
              </div>
              <button
                onClick={() => { setItems([]); setErrors([]); setProgress(0); }}
                className="text-gray-500 hover:text-gray-300 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Table */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-left text-gray-400">
                      <th className="px-4 py-2">#</th>
                      <th className="px-4 py-2">Title</th>
                      <th className="px-4 py-2">Category</th>
                      <th className="px-4 py-2">Priority</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {items.map((item, i) => (
                      <tr
                        key={i}
                        className={item._valid ? '' : 'bg-red-500/5'}
                      >
                        <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                        <td className="px-4 py-2 text-white">
                          {item.title || <span className="text-red-400">Missing</span>}
                        </td>
                        <td className="px-4 py-2 text-gray-300">{item.category_slug || '-'}</td>
                        <td className="px-4 py-2 text-gray-300">{item.priority || 'medium'}</td>
                        <td className="px-4 py-2">
                          {item._valid ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <span className="text-xs text-red-400">{item._error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Progress */}
            {importing && (
              <div className="mb-4">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{progress}% complete</p>
              </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-1">
                <p className="text-sm font-medium text-red-400">Import errors:</p>
                {errors.map((e) => (
                  <p key={e.index} className="text-xs text-red-300">
                    Item {e.index + 1}: {e.error}
                  </p>
                ))}
              </div>
            )}

            {/* Import button */}
            <button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? 'Importing...' : `Import ${validCount} updates`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
