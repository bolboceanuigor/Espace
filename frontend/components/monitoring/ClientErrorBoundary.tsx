'use client';

import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export default class ClientErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  private onUnhandledError?: (event: ErrorEvent) => void;
  private onUnhandledRejection?: (event: PromiseRejectionEvent) => void;

  private async reportClientError(payload: {
    message: string;
    stack: string;
    route: string;
    metadata: Record<string, unknown>;
  }) {
    const { systemMonitoringApi } = await import('@/lib/api');
    return systemMonitoringApi.reportClientError(payload).catch(() => undefined);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.reportClientError({
        message: error.message || 'Client rendering error',
        stack: error.stack || errorInfo.componentStack || '',
        route: typeof window !== 'undefined' ? window.location.pathname : '',
        metadata: {
          componentStack: errorInfo.componentStack || '',
          href: typeof window !== 'undefined' ? window.location.href : '',
        },
      });
  }

  componentDidMount() {
    this.onUnhandledError = (event: ErrorEvent) => {
      this.reportClientError({
          message: event.message || 'Unhandled window error',
          stack: event.error?.stack || '',
          route: window.location.pathname,
          metadata: {
            filename: event.filename || '',
            lineno: event.lineno || 0,
            colno: event.colno || 0,
            href: window.location.href,
          },
        });
    };
    this.onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason || 'Unhandled rejection');
      const stack = reason instanceof Error ? reason.stack || '' : '';
      this.reportClientError({
          message,
          stack,
          route: window.location.pathname,
          metadata: { kind: 'unhandledrejection', href: window.location.href },
        });
    };
    window.addEventListener('error', this.onUnhandledError);
    window.addEventListener('unhandledrejection', this.onUnhandledRejection);
  }

  componentWillUnmount() {
    if (this.onUnhandledError) window.removeEventListener('error', this.onUnhandledError);
    if (this.onUnhandledRejection) window.removeEventListener('unhandledrejection', this.onUnhandledRejection);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-border/70 bg-card p-5 text-center text-sm text-foreground">
          <h1 className="text-lg font-semibold text-foreground">Pagina nu s-a încărcat corect</h1>
          <p className="mt-2 text-muted-foreground">
            A apărut o eroare de afișare. Poți reîncărca pagina sau reveni la autentificare.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border/60 px-3 text-sm font-medium text-foreground transition hover:bg-muted/60"
              onClick={() => window.location.reload()}
            >
              Reîncarcă
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border/60 px-3 text-sm font-medium text-foreground transition hover:bg-muted/60"
              onClick={() => {
                window.location.href = '/login';
              }}
            >
              Autentificare
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
