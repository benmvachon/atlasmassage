/**
 * Renders a loading message, error message, or empty-state message
 * in place of content. Renders children when none of those apply.
 *
 * Usage:
 *   <PageState loading={loading} error={error} empty={!items.length} emptyMessage="No items.">
 *     {items.map(...)}
 *   </PageState>
 */
export default function PageState({
  loading,
  error,
  empty = false,
  emptyMessage = 'Nothing to show.',
  loadingMessage = 'Loading…',
  loadingClass = 'settings-muted',
  errorClass = 'settings-error',
  emptyClass = 'settings-muted',
  children,
}) {
  if (loading) return <p className={loadingClass}>{loadingMessage}</p>;
  if (error)   return <p className={errorClass} role="alert">{error}</p>;
  if (empty)   return <p className={emptyClass}>{emptyMessage}</p>;
  return children ?? null;
}
