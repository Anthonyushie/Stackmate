import React from 'react';

type ErrorBoundaryProps = { children: React.ReactNode };

type ErrorBoundaryState = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    try { console.error('[ErrorBoundary]', error, info); } catch {}
  }

  handleRetry = () => {
    try { this.setState({ hasError: false, error: undefined }); } catch {}
  };

  handleReport = async () => {
    try {
      const body = `Stackmate error report\nTime: ${new Date().toISOString()}\nMessage: ${String(this.state.error?.message || this.state.error)}\n`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(body);
        alert('Error details copied to clipboard. Please share with the team.');
      } else {
        alert('Copy this message and share with the team:\n' + body);
      }
    } catch {}
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const brutal = 'rounded-none border-[3px] border-black shadow-[8px_8px_0_#000]';
      return (
        <div className="min-h-screen bg-gradient-to-br from-yellow-200 via-rose-200 to-blue-200 flex items-center justify-center p-4">
          <div className={`${brutal} bg-white p-6 max-w-lg w-full`}>
            <div className="text-xl font-black mb-2">Something went wrong</div>
            <div className="text-sm opacity-80 mb-4">An unexpected error occurred. You can try again or report the error.</div>
            <div className="flex items-center gap-2">
              <button className={`${brutal} bg-black text-white px-3 py-2`} onClick={this.handleRetry}>Retry</button>
              <button className={`${brutal} bg-zinc-200 px-3 py-2`} onClick={() => window.location.reload()}>Reload</button>
              <button className={`${brutal} bg-white px-3 py-2`} onClick={this.handleReport}>Report error</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
