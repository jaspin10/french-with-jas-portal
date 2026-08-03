export default async function handler(req, res) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' })
      return
    }
  
    const key = process.env.GEMINI_API_KEY
    if (!key) {
      res.status(500).json({ error: 'No API key configured' })
      return
    }
  
    const body = req.body || {}
    const mode = body.mode === 'paragraph' ? 'paragraph'
      : body.mode === 'analysis' ? 'analysis'
      : 'sentence'
  
    const taxonomy = 'word_order, spelling, accents, punctuation, capitalization, tense, conjugation, agreement, article, preposition, vocabulary, missing_words, extra_words, elision'
  
    let prompt
  
    if (mode === 'analysis') {
      const counts = body.mistake_counts || {}
      const score = typeof body.score === 'number' ? body.score : null
      const examples = (body.examples || []).slice(0, 20)
      const previous = (body.previous || []).slice(0, 4)
      let summary = ''
      Object.keys(counts).forEach(function (k) {
        summary += k + ': ' + counts[k] + '\n'
      })
      let exampleText = ''
      examples.forEach(function (ex) {
        exampleText += '- English: ' + String(ex.english || '').slice(0, 200) +
          ' | Student: ' + String(ex.answer || '').slice(0, 200) +
          ' | Correct: ' + String(ex.model || '').slice(0, 200) + '\n'
      })
      let historyText = ''
      previous.forEach(function (p, i) {
        let pc = ''
        const pcounts = p.mistake_counts || {}
        Object.keys(pcounts).forEach(function (k) {
          pc += (pc ? ', ' : '') + k + ': ' + pcounts[k]
        })
        historyText += '- ' + (i + 1) + ' week(s) ago: score ' +
          (typeof p.score === 'number' ? p.score : '?') + '/100, mistakes: ' +
          (pc || 'none') + '\n'
      })
      prompt = 'You are a supportive French teacher writing a short weekly progress analysis for an immigrant learner in Canada (CLB 5-8) who just finished their Monday translation homework.\n\n' +
        'Mistake counts by category this week:\n' + (summary || 'none - perfect week') + '\n' +
        (score != null ? 'Overall score: ' + score + '/100\n' : '') +
        (historyText ? '\nPrevious weeks (most recent first):\n' + historyText : '') +
        (exampleText ? '\nSample errors (English prompt | student answer | correct answer):\n' + exampleText : '') + '\n' +
        'Write 3-6 short sentences in simple English (with French grammar terms where useful):\n' +
        '- Identify the 1-2 mistake categories that come up most this week and explain the likely root cause (e.g. adjective agreement, forgetting final punctuation, anglicisms).\n' +
        (historyText
          ? '- Compare with the previous weeks: mention concretely which categories improved or got worse and whether the score is trending up or down (e.g. "accents dropped from 8 to 3 - good progress"). If this is clearly better or worse than last week, say so plainly.\n'
          : '') +
        '- Give one concrete, specific thing to practice this week to fix the biggest weakness.\n' +
        '- End with one short encouraging sentence.\n' +
        'If there are no mistakes, congratulate them briefly and suggest what to aim for next.\n\n' +
        'Respond ONLY with JSON, no markdown fences, exactly this shape:\n' +
        '{"analysis": "the analysis text"}'
    } else {
      const english = (body.english || '').slice(0, 4000)
      const model = (body.model || '').slice(0, 4000)
      const answer = (body.answer || '').slice(0, 4000)
  
      if (!english || !model || !answer) {
        res.status(400).json({ error: 'Missing fields' })
        return
      }
  
      if (mode === 'sentence') {
        prompt = 'You are a strict but fair French teacher grading a translation exercise for immigrant learners in Canada (CLB 5-8).\n\n' +
          'English sentence: ' + english + '\n' +
          'Model French answer: ' + model + '\n' +
          'Student answer: ' + answer + '\n\n' +
          'Rules:\n' +
          '- Accept any natural, correct French translation, not only the model answer. Vocabulary alternatives are fine if meaning is fully preserved.\n' +
          '- Accept both ils and elles when English "they" gives no gender clue. Accept both tu and vous when "you" is ambiguous, unless context forces one.\n' +
          '- If the English prompt contains a French infinitive in brackets, the student must use that verb; a different verb is a vocabulary mistake.\n' +
          '- STRICT: any mistake at all (missing final period or question mark, missing capital letter, one wrong accent, wrong elision, spelling, wrong tense, wrong agreement, word order, missing or extra words, changed meaning) means correct=false.\n' +
          '- Tag every mistake found using ONLY these categories: ' + taxonomy + '\n' +
          '- accents is for accent-only errors; spelling is for other letter errors.\n\n' +
          'Respond ONLY with JSON, no markdown fences, exactly this shape:\n' +
          '{"correct": true|false, "mistakes": ["category", ...], "note": "one short sentence in simple French explaining the main error, or empty string if correct"}'
      } else {
        prompt = 'You are a strict but fair French teacher grading a CLB 8 paragraph translation for immigrant learners in Canada preparing the TCF.\n\n' +
          'English source text: ' + english + '\n' +
          'Model French translation: ' + model + '\n' +
          'Student translation: ' + answer + '\n\n' +
          'Rules:\n' +
          '- Accept natural alternative phrasing and vocabulary; grade meaning, grammar, and mechanics, not similarity to the model.\n' +
          '- Punctuation and capitalization are strict.\n' +
          '- Tag every mistake found using ONLY these categories (repeat a category once per distinct error): ' + taxonomy + '\n' +
          '- Score /100: start at 100, subtract fairly per error by severity (small mechanics 1-2, grammar 3-5, meaning errors 5-10).\n\n' +
          'Respond ONLY with JSON, no markdown fences, exactly this shape:\n' +
          '{"score": 0-100, "mistakes": ["category", ...], "note": "2-3 short sentences in simple French: main strengths and the top areas to fix", "corrected": "the corrected version of the student text"}'
      }
    }
  
    try {
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=' + key,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      )
      const data = await r.json()
      const text =
        data &&
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] &&
        data.candidates[0].content.parts[0].text
      if (!text) {
        const detail = data && data.error ? data.error.message : JSON.stringify(data).slice(0, 300)
        res.status(502).json({ error: 'No response from model', detail: detail })
        return
      }
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      res.status(200).json(parsed)
    } catch (err) {
      res.status(502).json({ error: 'Grading failed', detail: String(err).slice(0, 300) })
    }
  }