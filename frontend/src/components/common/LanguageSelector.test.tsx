import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import LanguageSelector from '@/components/common/LanguageSelector';
import { LanguageContext, type LanguageContextValue } from '@/context/language-context';

const renderWithLanguage = (value: LanguageContextValue) =>
  render(
    <LanguageContext.Provider value={value}>
      <LanguageSelector />
    </LanguageContext.Provider>,
  );

describe('LanguageSelector', () => {
  it('does not render when tenant has only one language', () => {
    const { container } = renderWithLanguage({
      language: 'es',
      defaultLanguage: 'es',
      supportedLanguages: ['es'],
      setLanguage: vi.fn(),
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders selector when tenant has more than one language', () => {
    const { container } = renderWithLanguage({
      language: 'es',
      defaultLanguage: 'es',
      supportedLanguages: ['es', 'en'],
      setLanguage: vi.fn(),
    });

    expect(container.querySelector('button')).toBeInTheDocument();
  });
});
