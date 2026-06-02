import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../../components/Modal.jsx';

const onClose = jest.fn();

beforeEach(() => { onClose.mockClear(); });

function renderModal(props = {}) {
  return render(
    <Modal title="Test Modal" onClose={onClose} {...props}>
      <p>Modal content</p>
    </Modal>
  );
}

describe('Modal', () => {
  it('renders the title and children', () => {
    renderModal();
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('has role="dialog" with aria-modal and aria-labelledby', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
  });

  it('calls onClose when the close button is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the overlay backdrop is clicked', () => {
    const { container } = renderModal();
    const overlay = container.querySelector('.modal-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when the panel itself is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies a custom maxWidth style when provided', () => {
    renderModal({ maxWidth: '400px' });
    expect(screen.getByRole('dialog')).toHaveStyle({ maxWidth: '400px' });
  });
});
