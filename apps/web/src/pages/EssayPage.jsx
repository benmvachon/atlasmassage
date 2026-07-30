import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { useEssayMarkdown } from '../hooks/useEssayMarkdown.js';
import { essayService } from '../services/essayService.js';
import { formatPublishedDate } from '../utils/essayMarkdown.js';
import EssayBody from '../components/EssayBody.jsx';

// Only top-level sections go in the contents nav — listing every h3 as well
// makes it longer than the essay is deep.
function Contents({ headings }) {
  const sections = headings.filter(h => h.level === 2);
  if (sections.length < 2) return null;

  return (
    <nav className="essay__contents" aria-label="Contents">
      <h2 className="essay__contents-title">Contents</h2>
      <ol className="essay__contents-list">
        {sections.map(h => (
          <li key={h.id}>
            <a href={`#${h.id}`}>{h.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function EssayPage() {
  const { slug } = useParams();
  const { data: essay, loading, error } = useAsync(() => essayService.get(slug), [slug]);
  const { html, headings } = useEssayMarkdown(essay?.body_markdown ?? '');

  useEffect(() => {
    if (essay?.title) document.title = `${essay.title} — Atlas Bodywork`;
    return () => { document.title = 'Atlas Bodywork'; };
  }, [essay?.title]);

  if (loading) {
    return (
      <div className="page page--essay">
        <p className="pathology__status">Loading essay…</p>
      </div>
    );
  }

  if (error || !essay) {
    return (
      <div className="page page--essay">
        <p className="pathology__status pathology__status--error">
          We couldn&apos;t find that essay.
        </p>
        <p className="essay__back-wrap">
          <Link to="/pathology" className="btn btn--outline btn--sm">All essays</Link>
        </p>
      </div>
    );
  }

  const published = formatPublishedDate(essay.published_at);

  return (
    <div className="page page--essay">
      <article className="essay">
        <Link to="/pathology" className="essay__back">← All essays</Link>

        <header className="essay__header">
          <h1 className="essay__title">{essay.title}</h1>
          {essay.subtitle && <p className="essay__subtitle">{essay.subtitle}</p>}
          <p className="essay__byline">
            {essay.author}
            {published && (
              <>
                {essay.author && ' · '}
                <time dateTime={essay.published_at}>{published}</time>
              </>
            )}
          </p>

          {essay.pdf_path && (
            <a
              className="btn btn--outline btn--sm essay__download"
              href={essayService.pdfUrl(essay.slug)}
              download
            >
              Download PDF
            </a>
          )}
        </header>

        {essay.hero_image_path && (
          <figure className="essay__hero">
            <img src={essay.hero_image_path} alt={essay.hero_image_alt || ''} />
            {essay.hero_image_alt && (
              <figcaption className="essay__hero-caption">{essay.hero_image_alt}</figcaption>
            )}
          </figure>
        )}

        <Contents headings={headings} />

        <EssayBody html={html} />

        <footer className="essay__footer">
          {essay.pdf_path && (
            <a
              className="btn btn--primary btn--sm"
              href={essayService.pdfUrl(essay.slug)}
              download
            >
              Download this essay as a PDF
            </a>
          )}
          <Link to="/booking" className="btn btn--outline btn--sm">Book a session</Link>
        </footer>
      </article>
    </div>
  );
}
