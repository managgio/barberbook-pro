import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ContactLinkText from './ContactLinkText';

afterEach(cleanup);

describe('ContactLinkText', () => {
  it('opens email contacts with the mail client without changing their text', () => {
    render(<ContactLinkText value="client@example.com" />);

    const link = screen.getByRole('link', { name: 'client@example.com' });
    expect(link).toHaveAttribute('href', 'mailto:client@example.com');
    expect(link).toHaveClass(
      'text-inherit',
      'no-underline',
      'hover:text-primary',
      'active:text-primary',
      'focus-visible:text-primary',
    );
  });

  it('opens phone contacts in WhatsApp using an international number', () => {
    render(<ContactLinkText value="+34 600 123 456" />);

    const link = screen.getByRole('link', { name: '+34 600 123 456' });
    expect(link).toHaveAttribute('href', 'https://wa.me/34600123456');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps combined guest contact text intact while linking both contact methods', () => {
    const { container } = render(
      <ContactLinkText value="guest@example.com · 0034 611 222 333" />,
    );

    expect(container).toHaveTextContent('guest@example.com · 0034 611 222 333');
    expect(screen.getByRole('link', { name: 'guest@example.com' })).toHaveAttribute(
      'href',
      'mailto:guest@example.com',
    );
    expect(screen.getByRole('link', { name: '0034 611 222 333' })).toHaveAttribute(
      'href',
      'https://wa.me/34611222333',
    );
  });

  it('leaves non-contact fallback text unchanged', () => {
    render(<ContactLinkText value="Sin datos de contacto" />);

    expect(screen.getByText('Sin datos de contacto')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
