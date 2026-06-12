import { imagePathFor, PLACEHOLDER_IMAGE, type ExerciseContent } from '@/domain/exerciseContent';
import { Badge } from './Badge';

/** Presentational detail card for any exercise (drill, prehab, session block) — BC-46.
 *  Renders the shared `ExerciseContent` shape: image (with a safe placeholder fallback),
 *  dosage, ordered how-to steps, form cues, and common mistakes. Gate-blind by design —
 *  it carries no logic; path resolution lives in the covered `exerciseContent.ts`. */
export function ExerciseDetail({ title, content }: { title?: string; content: ExerciseContent }) {
  return (
    <div className="space-y-3">
      {title ? <h2 style={{ fontSize: 'var(--fs-lg)' }}>{title}</h2> : null}

      <img
        src={imagePathFor(content.imageId)}
        alt={title ? `${title} illustration` : 'Exercise illustration'}
        style={{
          width: '100%',
          maxHeight: 200,
          objectFit: 'contain',
          borderRadius: 'var(--r-md)',
          background: 'var(--bg-sunk)',
          border: '2px solid var(--border)',
        }}
        onError={(e) => {
          e.currentTarget.src = PLACEHOLDER_IMAGE;
        }}
      />

      {content.dosage ? (
        <div>
          <Badge tone="brand">{content.dosage}</Badge>
        </div>
      ) : null}

      {content.steps.length > 0 ? (
        <section>
          <div className="bc-eyebrow">How to</div>
          <ol style={{ marginTop: 4, paddingLeft: '1.25rem', listStyle: 'decimal' }}>
            {content.steps.map((s, i) => (
              <li key={i} style={{ fontSize: 'var(--fs-sm)', marginBottom: 4 }}>
                {s}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {content.cues.length > 0 ? (
        <section>
          <div className="bc-eyebrow">Cues</div>
          <ul style={{ marginTop: 4, paddingLeft: '1.25rem', listStyle: 'disc' }}>
            {content.cues.map((c, i) => (
              <li key={i} style={{ fontSize: 'var(--fs-sm)', marginBottom: 2 }}>
                {c}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {content.commonMistakes.length > 0 ? (
        <section>
          <div className="bc-eyebrow" style={{ color: 'var(--warning-deep)' }}>
            Avoid
          </div>
          <ul style={{ marginTop: 4, paddingLeft: '1.25rem', listStyle: 'disc' }}>
            {content.commonMistakes.map((m, i) => (
              <li
                key={i}
                style={{ fontSize: 'var(--fs-sm)', marginBottom: 2, color: 'var(--text-muted)' }}
              >
                {m}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
