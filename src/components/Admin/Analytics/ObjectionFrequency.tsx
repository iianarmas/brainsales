'use client';

import { ShieldAlert } from 'lucide-react';

interface Objection {
  nodeId: string;
  nodeTitle: string;
  count: number;
  percentage: number;
}

export function ObjectionFrequency({ objections }: { objections: Objection[] }) {
  const maxCount = objections[0]?.count || 1;

  return (
    <div className="bg-white border border-primary-light/20 rounded-xl p-5 shadow-xl">
      <div className="flex items-center gap-2 mb-5">
        <ShieldAlert className="h-5 w-5 text-red-400" />
        <h3 className="text-base font-semibold text-primary">Objection Frequency</h3>
      </div>

      {objections.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No objections tracked yet</p>
      ) : (
        <div className="space-y-3">
          {objections.map((obj) => (
            <div key={obj.nodeId}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600 truncate mr-2">{obj.nodeTitle}</span>
                <span className="text-sm font-medium text-gray-700 shrink-0">
                  {obj.count} <span className="text-gray-400 text-xs">({obj.percentage}%)</span>
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-red-400 transition-all duration-500"
                  style={{ width: `${(obj.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
