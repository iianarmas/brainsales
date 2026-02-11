'use client';

import { AlertTriangle } from 'lucide-react';

interface DropOffNode {
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
  count: number;
  percentage: number;
}

const NODE_TYPE_COLORS: Record<string, string> = {
  opening: 'bg-blue-100 text-blue-700',
  discovery: 'bg-purple-100 text-purple-700',
  pitch: 'bg-green-100 text-green-700',
  objection: 'bg-red-100 text-red-700',
  close: 'bg-amber-100 text-amber-700',
  voicemail: 'bg-gray-100 text-gray-600',
  end: 'bg-gray-100 text-gray-600',
};

export function DropOffAnalysis({ nodes }: { nodes: DropOffNode[] }) {
  const maxCount = nodes[0]?.count || 1;

  return (
    <div className="bg-white border border-primary-light/20 rounded-xl p-5 shadow-xl">
      <div className="flex items-center gap-2 mb-5">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <h3 className="text-base font-semibold text-primary">Drop-off Points</h3>
      </div>

      {nodes.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No drop-off data available</p>
      ) : (
        <div className="space-y-2.5">
          {nodes.slice(0, 8).map((node, i) => (
            <div key={node.nodeId} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-5 text-right font-mono">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-gray-700 truncate">{node.nodeTitle}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    NODE_TYPE_COLORS[node.nodeType] || 'bg-gray-100 text-gray-600'
                  }`}>
                    {node.nodeType}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${(node.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-medium text-gray-700">{node.count}</span>
                <span className="text-xs text-gray-400 ml-1">({node.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
