import { supabase } from './supabase'

// Called after each graded ladder item. If ALL Monday ladder items for the
// current cycle are done and no evaluation row exists yet, computes the
// weekly score + mistake tally, asks the AI for the analysis, and stores it.
export async function maybeCreateMondayEvaluation(profileId) {
  const cyc = await supabase.from('global_cycle').select('*').eq('id', 1).maybeSingle()
  if (!cyc.data) return
  const hwId = cyc.data.current_homework_id
  const cycleNumber = cyc.data.cycle_number || 1

  // Already evaluated this week+cycle?
  const existing = await supabase
    .from('monday_evaluations')
    .select('id')
    .eq('student_id', profileId)
    .eq('homework_id', hwId)
    .eq('cycle_number', cycleNumber)
    .maybeSingle()
  if (existing.data) return

  // All Monday ladder items
  const content = await supabase
    .from('homework_content')
    .select('id, prompt, correction, extra, item_type')
    .eq('homework_id', hwId)
    .eq('day', 'monday')
  const ladder = (content.data || []).filter(function (c) {
    return c.item_type === 'solve' && c.extra && c.extra.mode === 'one_by_one'
  })
  if (ladder.length === 0) return
  const ids = ladder.map(function (c) { return c.id })

  const att = await supabase
    .from('item_attempts')
    .select('content_id, answer, is_correct, mistakes, ai_score')
    .eq('student_id', profileId)
    .in('content_id', ids)
  const attempts = att.data || []
  if (attempts.length < ladder.length) return // not finished yet

  // Score: sentences count 100/0 by is_correct, paragraphs use ai_score
  let sum = 0
  const counts = {}
  const examples = []
  const byId = {}
  ladder.forEach(function (c) { byId[c.id] = c })

  attempts.forEach(function (a) {
    if (a.ai_score != null) {
      sum += a.ai_score
    } else {
      sum += a.is_correct ? 100 : 0
    }
    ;(a.mistakes || []).forEach(function (m) {
      counts[m] = (counts[m] || 0) + 1
    })
    if (!a.is_correct && examples.length < 20 && byId[a.content_id]) {
      examples.push({
        english: byId[a.content_id].prompt,
        answer: a.answer,
        model: byId[a.content_id].correction
      })
    }
  })
  const score = Math.round(sum / attempts.length)

  // Ask the AI for the weekly analysis (best-effort)
  let analysis = null
  try {
    const r = await fetch('/api/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'analysis',
        mistake_counts: counts,
        score: score,
        examples: examples
      })
    })
    if (r.ok) {
      const g = await r.json()
      if (g && g.analysis) analysis = g.analysis
    }
  } catch (err) {
    analysis = null
  }

  await supabase.from('monday_evaluations').insert({
    student_id: profileId,
    homework_id: hwId,
    cycle_number: cycleNumber,
    score: score,
    mistake_counts: counts,
    analysis: analysis
  })
}