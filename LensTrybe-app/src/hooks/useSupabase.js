import { useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'

function useSupabase() {
  return useMemo(() => supabase, [])
}

export default useSupabase
