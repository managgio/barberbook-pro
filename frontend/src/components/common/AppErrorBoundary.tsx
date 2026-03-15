import React from 'react';
import { translateUi } from '@/lib/i18n';
import { getRequestLanguage } from '@/lib/language';

type AppErrorBoundaryState = {
  hasError: boolean;
};

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('AppErrorBoundary captured an error', error, info);
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    const t = (key: string) =>
      translateUi({
        language: getRequestLanguage(),
        defaultLanguage: 'es',
        key,
      });

    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="max-w-lg w-full rounded-2xl border border-border bg-card p-8 shadow-lg text-center space-y-4">
          <h1 className="text-2xl font-semibold">{t('appErrorBoundary.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('appErrorBoundary.description')}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm font-medium"
          >
            {t('appErrorBoundary.actions.reload')}
          </button>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
