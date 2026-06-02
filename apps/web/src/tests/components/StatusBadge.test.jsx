import { render, screen } from '@testing-library/react';
import StatusBadge from '../../components/StatusBadge.jsx';

describe('StatusBadge', () => {
  it('renders the status label', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('formats no_show as "No Show"', () => {
    render(<StatusBadge status="no_show" />);
    expect(screen.getByText('No Show')).toBeInTheDocument();
  });

  it('replaces underscores with spaces for unknown statuses', () => {
    render(<StatusBadge status="some_status" />);
    expect(screen.getByText('some status')).toBeInTheDocument();
  });

  it('applies the active class for "active" status', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('active')).toHaveClass('settings-badge--active');
  });

  it('applies the cancelled class for "cancelled" status', () => {
    render(<StatusBadge status="cancelled" />);
    expect(screen.getByText('cancelled')).toHaveClass('settings-badge--cancelled');
  });

  it('applies the paused class for "pending" status', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText('pending')).toHaveClass('settings-badge--paused');
  });

  it('applies the info class for "completed" status', () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText('completed')).toHaveClass('settings-badge--info');
  });

  it('applies expired → cancelled class', () => {
    render(<StatusBadge status="expired" />);
    expect(screen.getByText('expired')).toHaveClass('settings-badge--cancelled');
  });
});
