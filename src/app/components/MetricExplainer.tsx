'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { RPE_SCALE, type Explainer } from '@/app/lib/explainers';

/**
 * A "(i)" trigger that opens a modal dialog explaining a metric (RPE / ACWR).
 * Presentational and gate-blind by design — all copy/band logic lives in the
 * covered `explainers` lib; this only toggles a dialog and renders an optional
 * inline-SVG diagram. Accessible: the trigger is a labelled button with
 * `aria-haspopup="dialog"`; the popup is a `role="dialog"`/`aria-modal` labelled
 * by its heading and closable via Escape, backdrop click, or the close button.
 */
export function MetricExplainer({
  explainer,
  diagram,
}: {
  explainer: Explainer;
  diagram?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={explainer.heading}
        onClick={() => {
          setOpen(true);
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
        <MetricExplainerDialog
          explainer={explainer}
          diagram={diagram}
          titleId={titleId}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/** The modal itself: a portalled, centred dialog over a dimmed backdrop. */
function MetricExplainerDialog({
  explainer,
  diagram,
  titleId,
  onClose,
}: {
  explainer: Explainer;
  diagram?: ReactNode;
  titleId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0, 0, 0, 0.45)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => {
          e.stopPropagation();
        }}
        style={{
          width: '100%',
          maxWidth: 360,
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: 16,
          borderRadius: 'var(--radius-lg, 16px)',
          background: 'var(--surface)',
          border: '2px solid var(--border)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <strong id={titleId} style={{ fontSize: 'var(--fs-md)' }}>
            {explainer.heading}
          </strong>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 999,
              border: '2px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <p
          style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {explainer.body}
        </p>
        {diagram && <div style={{ marginTop: 12 }}>{diagram}</div>}
      </div>
    </div>,
    document.body,
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
