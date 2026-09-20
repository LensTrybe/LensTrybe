import { Component } from 'react'

/* The last thing between a thrown render and a white screen.
 *
 * React unmounts the whole tree when a render throws and nothing catches it,
 * which is why a single bad line anywhere under the route table shows up as a
 * blank page with no clue on it. This catches that and prints what happened.
 *
 * In dev it prints the message, the stack and the component stack, so the fault
 * can be read off the page itself without opening the console. In production it
 * says something a client can act on and offers a reload, because a stack trace
 * is not their problem.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    // Still log it: the console keeps the clickable source links the page cannot.
    console.error('[LensTrybe] A render threw and was caught by the boundary:', error, info)
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    const dev = Boolean(import.meta.env && import.meta.env.DEV)

    return (
      <div style={{
        minHeight: '100dvh',
        background: '#0a0a0f',
        color: '#ffffff',
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: '48px 24px',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <div style={{ width: '100%', maxWidth: '820px' }}>
          <p style={{
            margin: '0 0 12px',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#FF2D78',
          }}>
            Something broke
          </p>

          <h1 style={{
            margin: 0,
            fontSize: '32px',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}>
            {dev ? 'This page threw while rendering' : 'This page could not load'}
          </h1>

          <p style={{
            margin: '14px 0 0',
            fontSize: '16px',
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.62)',
          }}>
            {dev
              ? 'The error is below. Nothing was lost, and a reload will start the page again once it is fixed.'
              : 'Nothing was lost. Reload the page, and if it keeps happening let us know what you were doing at the time.'}
          </p>

          {dev && (
            <div style={{
              marginTop: '24px',
              background: 'rgba(255,45,120,0.08)',
              border: '1px solid rgba(255,45,120,0.35)',
              borderRadius: '12px',
              padding: '18px 20px',
            }}>
              <div style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#FF2D78',
                wordBreak: 'break-word',
              }}>
                {String(error && error.message ? error.message : error)}
              </div>

              {error && error.stack && (
                <pre style={{
                  margin: '14px 0 0',
                  fontSize: '12px',
                  lineHeight: 1.55,
                  color: 'rgba(255,255,255,0.72)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}>
                  {String(error.stack)}
                </pre>
              )}

              {info && info.componentStack && (
                <pre style={{
                  margin: '14px 0 0',
                  paddingTop: '14px',
                  borderTop: '1px solid rgba(255,255,255,0.12)',
                  fontSize: '12px',
                  lineHeight: 1.55,
                  color: 'rgba(255,255,255,0.55)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}>
                  {String(info.componentStack)}
                </pre>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '26px' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: 'none',
                borderRadius: '12px',
                background: '#1DB954',
                color: '#04120a',
                fontFamily: 'inherit',
                fontSize: '15px',
                fontWeight: 800,
                padding: '14px 24px',
                cursor: 'pointer',
              }}
            >
              Reload the page
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/' }}
              style={{
                borderRadius: '12px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.22)',
                color: '#ffffff',
                fontFamily: 'inherit',
                fontSize: '15px',
                fontWeight: 600,
                padding: '14px 24px',
                cursor: 'pointer',
              }}
            >
              Back to home
            </button>
          </div>
        </div>
      </div>
    )
  }
}
