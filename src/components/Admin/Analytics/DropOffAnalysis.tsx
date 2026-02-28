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
  opening: 'bg-blue-500/10 text-blue-400',
  discovery: 'bg-purple-500/10 text-purple-400',
  pitch: 'bg-green-500/10 text-green-400',
  objection: 'bg-red-500/10 text-red-400',
  close: 'bg-amber-500/10 text-amber-400',
  voicemail: 'bg-surface text-muted-foreground',
  end: 'bg-surface text-muted-foreground',
};

export function DropOffAnalysis({ nodes }: { nodes: DropOffNode[] }) {
  const maxCount = nodes[0]?.count || 1;

  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5 shadow-xl">
      <div className="flex items-center gap-2 mb-5">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <h3 className="text-base font-semibold text-foreground">Drop-off Points</h3>
      </div>

      {nodes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No drop-off data available</p>
      ) : (
        <div className="space-y-2.5">
          {nodes.slice(0, 8).map((node, i) => (
            <div key={node.nodeId} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-5 text-right font-mono">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-foreground truncate">{node.nodeTitle}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${NODE_TYPE_COLORS[node.nodeType] || 'bg-surface text-muted-foreground'
                    }`}>
                    {node.nodeType}
                  </span>
                </div>
                <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${(node.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-medium text-foreground">{node.count}</span>
                <span className="text-xs text-muted-foreground ml-1">({node.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
