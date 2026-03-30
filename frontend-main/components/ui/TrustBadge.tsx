// @ts-nocheck
"use client";

export default function TrustBadge({ type, label, title }: { type: string; label: string; title?: string }) {
  return (
    <span className={`trust-badge ${type}`} title={title || label}>
      {type === 'fresh' ? '✓' : type === 'warn' ? '⚠' : type === 'crit' ? '⚑' : type === 'derived' ? '∂' : ''} {label}
    </span>
  );
}
