import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null; info: ErrorInfo | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error) {
    return { error, info: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info })
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 24, margin: 16,
          background: '#1a1010', border: '1px solid #802020',
          borderRadius: 8, color: '#e0b0b0',
          fontFamily: 'monospace', fontSize: 13,
          whiteSpace: 'pre-wrap', maxHeight: '80vh', overflow: 'auto',
        }}>
          <h2 style={{ color: '#e04040', marginBottom: 12 }}>⚠️ React Error</h2>
          <div style={{ marginBottom: 12 }}>
            <strong>{this.state.error.name}</strong>: {this.state.error.message}
          </div>
          <details>
            <summary style={{ cursor: 'pointer', color: '#c09060' }}>Stack trace</summary>
            <pre style={{ marginTop: 8, color: '#a09080', fontSize: 11 }}>{this.state.error.stack}</pre>
          </details>
          {this.state.info && (
            <details>
              <summary style={{ cursor: 'pointer', color: '#c09060', marginTop: 8 }}>Component stack</summary>
              <pre style={{ marginTop: 8, color: '#a09080', fontSize: 11 }}>{this.state.info.componentStack}</pre>
            </details>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
