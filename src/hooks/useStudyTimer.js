import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const INACTIVITY_LIMIT = 120 // seconds without activity before pausing
const SAVE_EVERY = 15        // save to DB every 15 seconds

export function useStudyTimer(studentId, homeworkId) {
  const [seconds, setSeconds] = useState(0)
  const [active, setActive] = useState(true)
  const lastActivity = useRef(Date.now())
  const unsaved = useRef(0)
  const loaded = useRef(false)

  // Load today's existing time once
  useEffect(function () {
    if (!studentId || !homeworkId || loaded.current) return
    loaded.current = true
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from('time_logs')
      .select('seconds')
      .eq('student_id', studentId)
      .eq('homework_id', homeworkId)
      .eq('day', today)
      .maybeSingle()
      .then(function (res) {
        if (res.data) setSeconds(res.data.seconds)
      })
  }, [studentId, homeworkId])

  // Listen for activity
  useEffect(function () {
    function poke() {
      lastActivity.current = Date.now()
      setActive(true)
    }
    window.addEventListener('mousemove', poke)
    window.addEventListener('keydown', poke)
    window.addEventListener('click', poke)
    window.addEventListener('scroll', poke)
    window.addEventListener('touchstart', poke)
    return function () {
      window.removeEventListener('mousemove', poke)
      window.removeEventListener('keydown', poke)
      window.removeEventListener('click', poke)
      window.removeEventListener('scroll', poke)
      window.removeEventListener('touchstart', poke)
    }
  }, [])

  // Tick every second
  useEffect(function () {
    const interval = setInterval(function () {
      const idle = (Date.now() - lastActivity.current) / 1000
      if (idle > INACTIVITY_LIMIT || document.hidden) {
        setActive(false)
        return
      }
      setSeconds(function (s) { return s + 1 })
      unsaved.current += 1
      if (unsaved.current >= SAVE_EVERY) {
        unsaved.current = 0
        save()
      }
    }, 1000)
    return function () { clearInterval(interval) }
  }, [studentId, homeworkId])

  function save() {
    if (!studentId || !homeworkId) return
    const today = new Date().toISOString().slice(0, 10)
    setSeconds(function (current) {
      supabase
        .from('time_logs')
        .upsert(
          {
            student_id: studentId,
            homework_id: homeworkId,
            day: today,
            seconds: current
          },
          { onConflict: 'student_id,homework_id,day' }
        )
        .then(function (res) {
          if (res.error) console.error('Timer save error:', res.error)
        })
      return current
    })
  }

  // Save when leaving the page
  useEffect(function () {
    function onLeave() { save() }
    window.addEventListener('beforeunload', onLeave)
    document.addEventListener('visibilitychange', onLeave)
    return function () {
      window.removeEventListener('beforeunload', onLeave)
      document.removeEventListener('visibilitychange', onLeave)
      save()
    }
  }, [studentId, homeworkId])

  return { seconds: seconds, active: active }
}