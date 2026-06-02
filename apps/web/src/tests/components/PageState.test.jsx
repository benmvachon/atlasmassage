import { render, screen } from '@testing-library/react';
import PageState from '../../components/PageState.jsx';

describe('PageState', () => {
  it('renders the loading message when loading=true', () => {
    render(<PageState loading>child</PageState>);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('child')).toBeNull();
  });

  it('uses a custom loading message when provided', () => {
    render(<PageState loading loadingMessage="Please wait…">child</PageState>);
    expect(screen.getByText('Please wait…')).toBeInTheDocument();
  });

  it('renders the error with role="alert" when error is provided', () => {
    render(<PageState error="Something broke">child</PageState>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something broke');
    expect(screen.queryByText('child')).toBeNull();
  });

  it('renders the empty message when empty=true', () => {
    render(<PageState empty emptyMessage="No results.">child</PageState>);
    expect(screen.getByText('No results.')).toBeInTheDocument();
    expect(screen.queryByText('child')).toBeNull();
  });

  it('renders children when not loading, no error, and not empty', () => {
    render(<PageState>child content</PageState>);
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('loading takes priority over error', () => {
    render(<PageState loading error="An error">child</PageState>);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
