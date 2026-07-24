import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { aggregateAttempts, TenseMasteryList } from '../pages/MyTenses'

export default function StudentTenses(props) {
  const studentId = props.studentId
  const [rows, setRows] = useState(null)

  useEffect(function () {
    async function load() {
      const res = await supabase
        .from('verb_attempts')
        .select('tense, correct_count, total')
        .eq('student_id', studentId)
      setRows(aggregateAttempts(res.data || []))
    }
    load()
  }, [studentId])

  if (!rows) return <div className="card">Loading tenses...</div>
  return <TenseMasteryList rows={rows} />
}