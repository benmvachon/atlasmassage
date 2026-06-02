import { render, screen } from '@testing-library/react';
import FormField from '../../components/FormField.jsx';

describe('FormField', () => {
  it('renders a label and an input', () => {
    render(<FormField label="Email" id="email" type="email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('associates the label with the input via htmlFor / id', () => {
    render(<FormField label="Username" id="username" />);
    const input = screen.getByLabelText('Username');
    expect(input).toHaveAttribute('id', 'username');
    expect(input).toHaveAttribute('name', 'username');
  });

  it('renders the error message with role="alert" when error is provided', () => {
    render(<FormField label="Email" id="email" error="Invalid email" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Invalid email');
  });

  it('does not render an alert when error is absent', () => {
    render(<FormField label="Email" id="email" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('adds the error modifier class when error is provided', () => {
    const { container } = render(<FormField label="Email" id="email" error="Oops" />);
    expect(container.firstChild).toHaveClass('form-field--error');
  });

  it('does not add the error class when error is absent', () => {
    const { container } = render(<FormField label="Email" id="email" />);
    expect(container.firstChild).not.toHaveClass('form-field--error');
  });

  it('forwards extra props (type, disabled, value) to the input', () => {
    render(<FormField label="Pass" id="pass" type="password" disabled value="secret" onChange={() => {}} />);
    const input = screen.getByLabelText('Pass');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toBeDisabled();
    expect(input).toHaveValue('secret');
  });
});
