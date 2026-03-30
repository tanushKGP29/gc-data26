// @ts-nocheck
"use client";

const ROLE_PRESETS = {
  operator: { label: 'Operator', icon: '◉', desc: 'Channel health, publish rate, anomalies' },
  executive: { label: 'Executive', icon: '◈', desc: 'High-level KPIs and trend overview' },
  analyst: { label: 'Analyst', icon: '⬡', desc: 'Full multi-dimensional access' },
};

export default function RoleSwitcher({ role, setRole }: { role: string; setRole: (r: string) => void }) {
  return (
    <div className="role-switcher">
      {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
        <button
          key={key}
          className={`role-btn ${role === key ? 'active' : ''}`}
          onClick={() => setRole(key)}
          title={preset.desc}
        >
          {preset.icon} {preset.label}
        </button>
      ))}
    </div>
  );
}
