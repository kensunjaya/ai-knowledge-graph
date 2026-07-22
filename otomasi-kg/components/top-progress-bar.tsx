import React from 'react';

export function TopProgressBar({ show = true }: { show?: boolean }) {
  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-zinc-100/50 overflow-hidden pointer-events-none">
      <div className="top-0 bottom-0 h-full bg-zinc-950 rounded-full animate-indeterminate" />
    </div>
  );
}
