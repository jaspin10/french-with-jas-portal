import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(function (res) {
      setSession(res.data.session)
      if (!res.data.session) setLoading(false)
    })
    const sub = supabase.auth.onAuthStateChange(function (_event, s) {
      setSession(s)
      if (!s) {
        setProfile(null)
        setLoading(false)
      }
    })
    return function () {
      sub.data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(function (res) {
        if (cancelled) return
        if (res.error) console.error('Profile fetch error:', res.error)
        setProfile(res.data)
        setLoading(false)
      })
    return function () {
      cancelled = true
    }
  }, [session])

  return { session, profile, loading }
}