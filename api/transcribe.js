export default async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
  
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }
  
    const { audio_base64, mime_type, mode, items, text } = req.body || {};
  
    if (!audio_base64) {
      return res.status(400).json({ error: "Missing audio_base64" });
    }
    if (mode !== "list" && mode !== "debate") {
      return res.status(400).json({ error: "mode must be list or debate" });
    }
  
    let instruction = "";
  
    if (mode === "list") {
      const numbered = (items || [])
        .map(function (it, i) { return (i + 1) + ". " + it; })
        .join("\n");
      instruction =
        "You are grading a French oral reading exercise for a language student.\n" +
        "The student was asked to say aloud the following " + (items || []).length + " French sentences in order:\n\n" +
        numbered + "\n\n" +
        "TASK:\n" +
        "1. Transcribe literally what you hear in the audio. Do NOT auto-correct toward the expected text; write what was actually said.\n" +
        "2. Compare each expected sentence to what the student said and mark it correct or wrong.\n\n" +
        "LENIENCY RULES (very important):\n" +
        "- The transcript is an imperfect rendering of speech. Segmentation and spacing artifacts are NOT mistakes: 'Le étéder nier' counts as 'L'été dernier'.\n" +
        "- Near-homophones, elision variations, and liaison artifacts count as correct.\n" +
        "- Only mark a sentence wrong if words are genuinely different, skipped, added incorrectly, or unmistakably mispronounced (wrong sounds, anglicized word, wrong ending that changes the word).\n" +
        "- When in doubt, the benefit of the doubt ALWAYS goes to the student.\n\n" +
        "Respond ONLY with JSON, no markdown fences, in this exact shape:\n" +
        "{\"transcript\":\"full literal transcript\",\"results\":[{\"n\":1,\"correct\":true,\"heard\":\"what was said for this sentence or empty if skipped\",\"issue\":\"short English note only if wrong\"}],\"score\":0,\"note\":\"one short encouraging sentence in French about the overall pronunciation\"}\n" +
        "score = the number of correct sentences.";
    } else {
      instruction =
        "You are grading a French oral reading exercise for a language student.\n" +
        "The student was asked to read aloud the following French paragraph:\n\n" +
        text + "\n\n" +
        "TASK:\n" +
        "1. Transcribe literally what you hear. Do NOT auto-correct toward the expected text.\n" +
        "2. Grade the reading out of 20 using this rubric: completeness (did they read the whole text), word accuracy (skipped/replaced words), pronunciation quality.\n\n" +
        "LENIENCY RULES (very important):\n" +
        "- Segmentation/spacing artifacts in transcription are NOT mistakes: 'Le étéder nier' counts as 'L'été dernier'.\n" +
        "- Near-homophones, elision and liaison variations count as correct.\n" +
        "- Only deduct for genuinely different words, skipped or added words, or unmistakably wrong sounds (anglicized words, wrong endings that change the word).\n" +
        "- When in doubt, the benefit of the doubt ALWAYS goes to the student.\n\n" +
        "Respond ONLY with JSON, no markdown fences, in this exact shape:\n" +
        "{\"transcript\":\"full literal transcript\",\"mistakes\":[{\"expected\":\"word or phrase\",\"heard\":\"what was said\",\"issue\":\"short English note\"}],\"score\":0,\"note\":\"two short sentences in French: what went well and what to improve\"}\n" +
        "score = integer from 0 to 20.";
    }
  
    try {
      const gRes = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" + apiKey,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: instruction },
                  {
                    inline_data: {
                      mime_type: mime_type || "audio/webm",
                      data: audio_base64
                    }
                  }
                ]
              }
            ]
          })
        }
      );
  
      const gData = await gRes.json();
  
      if (!gRes.ok) {
        return res.status(502).json({
          error: "Gemini request failed",
          detail: gData && gData.error ? gData.error.message : "unknown"
        });
      }
  
      const raw =
        gData.candidates &&
        gData.candidates[0] &&
        gData.candidates[0].content &&
        gData.candidates[0].content.parts
          ? gData.candidates[0].content.parts
              .map(function (p) { return p.text || ""; })
              .join("")
          : "";
  
      const clean = raw.replace(/```json|```/g, "").trim();
  
      let parsed;
      try {
        parsed = JSON.parse(clean);
      } catch (e) {
        return res.status(502).json({ error: "Bad AI response", detail: clean.slice(0, 300) });
      }
  
      return res.status(200).json(parsed);
    } catch (err) {
      return res.status(500).json({ error: "Transcription failed", detail: String(err) });
    }
  }