import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { essayService } from '../services/essayService.js';
import { formatPublishedDate } from '../utils/essayMarkdown.js';

function EssayCard({ essay }) {
  const published = formatPublishedDate(essay.published_at);
  const href = `/pathology/${essay.slug}`;

  return (
    <li className="essay-card">
      {essay.hero_image_path && (
        // Decorative duplicate of the title link — hidden from assistive tech and
        // the tab order so the card is a single stop.
        <Link to={href} className="essay-card__media" aria-hidden="true" tabIndex={-1}>
          <img
            className="essay-card__image"
            src={essay.hero_image_path}
            alt=""
            loading="lazy"
          />
        </Link>
      )}

      <div className="essay-card__main">
        <h2 className="essay-card__title">
          <Link to={href} className="essay-card__title-link">{essay.title}</Link>
        </h2>
        {essay.subtitle && <p className="essay-card__subtitle">{essay.subtitle}</p>}
        {essay.summary && <p className="essay-card__summary">{essay.summary}</p>}
        <p className="essay-card__meta">
          {essay.author}
          {published && (
            <>
              {essay.author && ' · '}
              <time dateTime={essay.published_at}>{published}</time>
            </>
          )}
        </p>

        <div className="essay-card__actions">
          <Link to={href} className="btn btn--primary btn--sm">Read essay</Link>
          {essay.pdf_path && (
            <a
              className="btn btn--outline btn--sm"
              href={essayService.pdfUrl(essay.slug)}
              download
            >
              Download PDF
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

export default function PathologyPage() {
  const { data: essays, loading, error } = useAsync(() => essayService.list(), []);

  return (
    <div className="page page--pathology">
      {loading && <p className="pathology__status">Loading essays…</p>}
      {error && (
        <p className="pathology__status pathology__status--error">
          Unable to load essays. Please try again later.
        </p>
      )}

      {!loading && !error && (
        essays?.length === 0 ? (
          <p className="pathology__status">No essays published yet — check back soon.</p>
        ) : (
          <ul className="pathology__list">
            {essays.map(essay => <EssayCard key={essay.id} essay={essay} />)}
          </ul>
        )
      )}
    </div>
  );
}
