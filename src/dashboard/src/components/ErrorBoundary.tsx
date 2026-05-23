import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Frontend Diagnostics] Caught render error:', error);
    console.error('[Frontend Diagnostics] Component stack:', errorInfo.componentStack);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-black text-rose-500 font-mono">
          <AlertTriangle className="mb-4 h-12 w-12" />
          <h1 className="text-xl font-bold tracking-widest uppercase">Fatal Render Exception</h1>
          <div className="mt-4 border border-rose-500/30 bg-rose-500/10 p-4 rounded-md max-w-2xl overflow-auto text-sm">
            <p className="font-semibold">{this.state.error?.toString()}</p>
          </div>
          <button 
            className="mt-8 border border-white/10 text-white/70 hover:bg-white/10 px-4 py-2 rounded transition-colors"
            onClick={() => window.location.reload()}
          >
            REBOOT SYSTEM
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
