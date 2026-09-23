import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '../Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Proxim ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            color: 'var(--text-on-surface, #F7F8F4)',
            fontFamily: 'var(--font-body, "Satoshi", sans-serif)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(255, 93, 168, 0.12)',
              border: '1px solid var(--danger, #FF5DA8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            ⚠️
          </div>
          <div style={{ fontSize: 'var(--type-18, 18px)', fontWeight: 700 }}>
            We couldn't load this screen
          </div>
          <div
            style={{
              fontSize: 'var(--type-13, 13px)',
              color: 'var(--text-muted, #9FB4B0)',
              maxWidth: 320,
              lineHeight: 1.5,
            }}
          >
            {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
          </div>
          <Button variant="primary" onClick={this.handleReset} style={{ marginTop: 8 }}>
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
