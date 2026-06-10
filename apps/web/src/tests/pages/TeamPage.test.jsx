import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TeamPage from '../../pages/TeamPage.jsx';
import { api } from '../../services/api.js';

jest.mock('../../services/api.js', () => ({ api: { get: jest.fn() } }));

function makeTherapist(overrides = {}) {
  return {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    first_name: 'Jane',
    last_name: 'Doe',
    bio: 'Certified in deep tissue and Swedish massage.',
    headshot_url: null,
    is_accepting_clients: true,
    ...overrides,
  };
}

function renderPage() {
  return render(<MemoryRouter><TeamPage /></MemoryRouter>);
}

beforeEach(() => jest.clearAllMocks());

describe('TeamPage — loading / error states', () => {
  it('shows a loading message while the request is in flight', () => {
    api.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error message when the API call rejects', async () => {
    api.get.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/unable to load team/i)).toBeInTheDocument()
    );
  });
});

describe('TeamPage — rendering therapist cards', () => {
  it('renders a card for each therapist returned by the API', async () => {
    api.get.mockResolvedValue({
      data: [
        makeTherapist({ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', first_name: 'Jane', last_name: 'Doe' }),
        makeTherapist({ id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', first_name: 'Alex', last_name: 'Smith' }),
      ],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
    expect(screen.getByText('Alex Smith')).toBeInTheDocument();
  });

  it('renders the therapist bio when present', async () => {
    api.get.mockResolvedValue({ data: [makeTherapist()] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/certified in deep tissue/i)).toBeInTheDocument()
    );
  });

  it('renders a "View availability" link for therapists accepting clients', async () => {
    api.get.mockResolvedValue({ data: [makeTherapist({ is_accepting_clients: true })] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /view availability/i })).toBeInTheDocument()
    );
  });

  it('renders a "not accepting" status for therapists not accepting clients', async () => {
    api.get.mockResolvedValue({ data: [makeTherapist({ is_accepting_clients: false })] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/not currently accepting new clients/i)).toBeInTheDocument()
    );
  });

  it('renders a photo placeholder when headshot_url is absent', async () => {
    api.get.mockResolvedValue({ data: [makeTherapist({ headshot_url: null })] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders an img tag when headshot_url is present', async () => {
    api.get.mockResolvedValue({
      data: [makeTherapist({ headshot_url: 'https://example.com/jane.jpg' })],
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('img', { name: /jane doe/i })).toBeInTheDocument()
    );
  });

  it('renders an empty list without crashing when no therapists are returned', async () => {
    api.get.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/meet our team/i)).toBeInTheDocument()
    );
    expect(screen.queryByRole('listitem')).toBeNull();
  });
});

describe('TeamPage — grid container', () => {
  it('renders the team grid as a list element', async () => {
    api.get.mockResolvedValue({ data: [makeTherapist()] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});
