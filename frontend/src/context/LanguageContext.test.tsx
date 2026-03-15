import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLanguage } from '@/hooks/useLanguage';
import { persistLanguage } from '@/lib/language';
import { LanguageProvider } from '@/context/LanguageContext';

let tenantState: {
  tenant: Record<string, unknown> | null;
  isReady: boolean;
  currentLocationId: string | null;
};
let authState: { user: { id?: string | null } | null };

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => tenantState,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}));

const LanguageProbe = () => {
  const { language, setLanguage } = useLanguage();
  return (
    <div>
      <span data-testid="language-value">{language}</span>
      <button type="button" onClick={() => setLanguage('en', { persistForUser: true })}>
        change-to-en
      </button>
    </div>
  );
};

describe('LanguageProvider', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
    tenantState = {
      tenant: null,
      isReady: true,
      currentLocationId: null,
    };
    authState = { user: null };
  });

  it('hard-locks platform tenant language to Spanish', async () => {
    tenantState = {
      tenant: {
        isPlatform: true,
        brand: { id: 'platform-brand' },
        config: {
          i18n: {
            defaultLanguage: 'en',
            supportedLanguages: ['en', 'es'],
          },
        },
      },
      isReady: true,
      currentLocationId: null,
    };

    render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('language-value')).toHaveTextContent('es');
    });

    fireEvent.click(screen.getByRole('button', { name: 'change-to-en' }));

    await waitFor(() => {
      expect(screen.getByTestId('language-value')).toHaveTextContent('es');
    });
  });

  it('restores user language preference for tenant-aware app', async () => {
    persistLanguage({
      language: 'en',
      brandId: 'brand-123',
      userId: 'user-123',
      persistForUser: true,
    });

    tenantState = {
      tenant: {
        isPlatform: false,
        brand: { id: 'brand-123' },
        config: {
          i18n: {
            defaultLanguage: 'es',
            supportedLanguages: ['es', 'en'],
          },
        },
      },
      isReady: true,
      currentLocationId: null,
    };
    authState = {
      user: {
        id: 'user-123',
      },
    };

    render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('language-value')).toHaveTextContent('en');
    });
  });

  it('follows updated tenant default when no explicit storage preference exists', async () => {
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'fr-FR',
    });
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['fr-FR'],
    });

    tenantState = {
      tenant: {
        isPlatform: false,
        brand: { id: 'brand-xyz' },
        config: {
          i18n: {
            defaultLanguage: 'en',
            supportedLanguages: ['es', 'en'],
          },
        },
      },
      isReady: true,
      currentLocationId: null,
    };

    const { rerender } = render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('language-value')).toHaveTextContent('en');
    });

    expect(window.localStorage.getItem('managgio.language.brand:brand-xyz')).toBeNull();

    tenantState = {
      tenant: {
        isPlatform: false,
        brand: { id: 'brand-xyz' },
        config: {
          i18n: {
            defaultLanguage: 'es',
            supportedLanguages: ['es', 'en'],
          },
        },
      },
      isReady: true,
      currentLocationId: null,
    };

    rerender(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('language-value')).toHaveTextContent('es');
    });
  });
});
