import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

async function verifySupabaseConnection(signal) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabase || !supabaseUrl || !supabaseAnonKey) {
    return false
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: {
      apikey: supabaseAnonKey,
    },
    signal,
  })

  return response.ok
}

function SupabaseConnectionTestPage() {
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const controller = new AbortController()

    const runConnectionCheck = async () => {
      try {
        const connected = await verifySupabaseConnection(controller.signal)
        setStatus(connected ? 'success' : 'failed')
      } catch (error) {
        if (error.name !== 'AbortError') {
          setStatus('failed')
        }
      }
    }

    runConnectionCheck()

    return () => {
      controller.abort()
    }
  }, [])

  return (
    <section>
      <header className="page-header">
        <h2>Supabase Connection Test</h2>
        <p>Temporary check page to verify your project credentials.</p>
      </header>

      <article className="panel">
        {status === 'loading' && <p>Checking Supabase connection...</p>}
        {status === 'success' && <p>Connected to Supabase successfully</p>}
        {status === 'failed' && <p>Connection failed</p>}
      </article>
    </section>
  )
}

export default SupabaseConnectionTestPage
