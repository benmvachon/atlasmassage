/**
 * Renders already-sanitized essay HTML from useEssayMarkdown. Shared by the
 * public reader and the owner dashboard preview so both look identical.
 *
 * The HTML is sanitized in renderEssayMarkdown — never pass raw input here.
 */
export default function EssayBody({ html, className = '' }) {
  return (
    <div
      className={`essay__body${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
