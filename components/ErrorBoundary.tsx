'use client';
import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Remy UI error:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ background: '#0b0f14', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#e8edf2', fontFamily: "'DM Sans', sans-serif", gap: '16px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>Something went wrong.</div>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            style={{ padding: '10px 24px', background: '#f07a2e', border: 'none', borderRadius: '10px', color: '#fff', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
