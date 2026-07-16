import React from 'react';

import {ErrorFallback} from './ErrorFallback';

type Props = {children?: React.ReactNode};
type State = {error: Error | null};

/**
 * Real error boundary. Previously this was a passthrough (`return children`),
 * so a render crash anywhere below `_layout`'s <ErrorBoundary> propagated to a
 * blank white screen and the sibling <ErrorFallback> was never used. It now
 * catches, logs, and renders the recoverable fallback UI.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Uncaught render error:', error, info.componentStack);
  }

  resetError = () => this.setState({error: null});

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback error={this.state.error} resetError={this.resetError} />
      );
    }
    return this.props.children;
  }
}
