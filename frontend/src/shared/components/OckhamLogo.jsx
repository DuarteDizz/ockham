import React from 'react';

const SIZE_MAP = {
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

export default function OckhamLogo({ showLabel = true, size = 'md', className = '' }) {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  const mark = (
    <div className={`relative flex ${sizeClass} items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.06] p-1.5 shadow-[0_16px_34px_rgba(0,0,0,0.2)]`}>
      <img
        src="/ockham-logo.png"
        alt="Ockham logo"
        className="h-full w-full object-contain drop-shadow-[0_8px_24px_rgba(25,189,215,0.22)]"
      />
    </div>
  );

  if (!showLabel) {
    return <div className={className}>{mark}</div>;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      {mark}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">AutoML Workspace</p>
        <div className="mt-0.5 flex items-center gap-2">
          <h1 className="font-heading text-[24px] font-bold tracking-[-0.04em] text-white">Ockham</h1>
        </div>
      </div>
    </div>
  );
}
