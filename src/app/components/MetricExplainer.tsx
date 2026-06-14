'use client';

import { useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { RPE_SCALE, type Explainer } from '@/app/lib/explainers';

/**
 * A tap-to-expand "(i)" affordance for a metric (RPE / ACWR). Presentational and
 * gate-blind by design — all copy/band logic lives in the covered `explainers` lib;
 * this only toggles a panel and renders an optional inline-SVG diagram. Accessible:
 * the trigger is a labelled button with `aria-expanded`/`aria-controls`.
 */
export function MetricExplainer({
  explainer,
  diagram,
}: {
  explainer: Explainer;
  diagram?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={explainer.heading}
        onClick={() => {
          setOpen((v) => !v);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: 999,
          border: '2px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Icon name="info" size={14} />
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={explainer.heading}
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 'var(--radius-md, 12px)',
            background: 'var(--surface-2, var(--surface))',
            border: '2px solid var(--border)',
          }}
        >
          <strong style={{ fontSize: 'var(--fs-sm)', display: 'block', marginBottom: 6 }}>
            {explainer.heading}
          </strong>
          <p
            style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {explainer.body}
          </p>
          {diagram && <div style={{ marginTop: 10 }}>{diagram}</div>}
        </div>
      )}
    </>
  );
}

/** A 1–10 gradient bar with the named anchor stops, illustrating the RPE scale. */
export function RpeScaleDiagram() {
  return (
    <svg viewBox="0 0 320 56" width="100%" role="img" aria-label="RPE scale from 1 to 10">
      <defs>
        <linearGradient id="rpe-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--success)" />
          <stop offset="55%" stopColor="var(--warning)" />
          <stop offset="100%" stopColor="var(--danger)" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="304" height="14" rx="7" fill="url(#rpe-grad)" />
      {RPE_SCALE.map((s) => {
        const x = 8 + ((s.value - 1) / 9) * 304;
        return (
          <g key={s.value}>
            <line x1={x} y1="6" x2={x} y2="24" stroke="var(--ink, #222)" strokeWidth="2" />
            <text x={x} y="38" textAnchor="middle" fontSize="9" fill="var(--text-muted)">
              {s.value}
            </text>
            <text x={x} y="50" textAnchor="middle" fontSize="8" fill="var(--text-soft)">
              {s.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const ACWR_ZONES = [
  { from: 0, to: 0.8, color: 'var(--text-soft)', label: 'low' },
  { from: 0.8, to: 1.3, color: 'var(--success)', label: 'sweet' },
  { from: 1.3, to: 1.5, color: 'var(--warning)', label: 'caution' },
  { from: 1.5, to: 2, color: 'var(--danger)', label: 'high' },
];

/** A zoned 0–2 bar (low / sweet / caution / high) with a marker at the current ratio. */
export function AcwrBandDiagram({ acwr }: { acwr: number }) {
  const scaleX = (v: number) => 8 + (Math.max(0, Math.min(2, v)) / 2) * 304;
  return (
    <svg viewBox="0 0 320 50" width="100%" role="img" aria-label={`ACWR band, yours is ${acwr}`}>
      {ACWR_ZONES.map((z) => (
        <rect
          key={z.label}
          x={scaleX(z.from)}
          y="8"
          width={scaleX(z.to) - scaleX(z.from)}
          height="14"
          fill={z.color}
        />
      ))}
      <text x={scaleX(1.05)} y="44" textAnchor="middle" fontSize="8" fill="var(--text-soft)">
        sweet 0.8–1.3
      </text>
      {acwr > 0 && (
        <g>
          <line
            x1={scaleX(acwr)}
            y1="4"
            x2={scaleX(acwr)}
            y2="26"
            stroke="var(--ink, #222)"
            strokeWidth="3"
          />
          <text
            x={scaleX(acwr)}
            y="36"
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill="var(--ink, #222)"
          >
            {acwr.toFixed(2)}
          </text>
        </g>
      )}
    </svg>
  );
}
