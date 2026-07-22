import React from 'react';

export function IndeterminateProgressBar({
  className = 'h-1 bg-zinc-900',
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            {label}
          </span>
          <span className="text-[10px] text-zinc-400 font-mono uppercase">Processing</span>
        </div>
      )}
      <div className="relative w-full h-1 bg-zinc-100 overflow-hidden rounded-full">
        <div className={`top-0 bottom-0 ${className} rounded-full animate-indeterminate`} />
      </div>
    </div>
  );
}
