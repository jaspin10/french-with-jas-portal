import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const TENSES = [
  { id: 'present', label: 'Présent', level: 2, group: 'simple' },
  { id: 'imparfait', label: 'Imparfait', level: 2, group: 'simple' },
  { id: 'futur_simple', label: 'Futur simple', level: 2, group: 'simple' },
  { id: 'passe_compose', label: 'Passé composé', level: 2, group: 'compound' },
  { id: 'plus_que_parfait', label: 'Plus-que-parfait', level: 3, group: 'compound' },
  { id: 'futur_anterieur', label: 'Futur antérieur', level: 3, group: 'compound' },
  { id: 'conditionnel_present', label: 'Conditionnel présent', level: 3, group: 'simple' },
  { id: 'conditionnel_passe', label: 'Conditionnel passé', level: 3, group: 'compound' },
  { id: 'passe_recent', label: 'Passé récent', level: 4, group: 'simple' },
  { id: 'futur_proche', label: 'Futur proche', level: 4, group: 'simple' },
  { id: 'subjonctif_present', label: 'Subjonctif présent', level: 4, group: 'simple' },
  { id: 'subjonctif_passe', label: 'Subjonctif passé', level: 4, group: 'compound' },
  { id: 'imperatif', label: 'Impératif', level: 4, group: 'final' },
  { id: 'gerondif', label: 'Gérondif', level: 4, group: 'final' },
  { id: 'infinitif', label: 'Infinitif', level: 4, group: 'final' },
  { id: 'participe', label: 'Participe', level: 4, group: 'final' },
];

// Order: simple, then compound, then final forms
const TENSE_ORDER = [
  ...TENSES.filter(function (t) { return t.group === 'simple'; }),
  ...TENSES.filter(function (t) { return t.group === 'compound'; }),
  ...TENSES.filter(function (t) { return t.group === 'final'; }),
];

const PRONOUNS = ['je', 'tu', 'il/elle', 'nous', 'vous', 'ils/elles'];
const IMPERATIF_LABELS = ['tu (présent)', 'nous (présent)', 'vous (présent)', 'tu (passé)', 'nous (passé)', 'vous (passé)'];
const GERONDIF_LABELS = ['présent', 'passé'];
const INFINITIF_LABELS = ['présent', 'passé'];
const PARTICIPE_LABELS = ['past participle', 'present participle'];

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function stripAccents(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Returns 'correct' | 'accents' | 'wrong'
function gradeAnswer(given, expected) {
  const g = normalize(given);
  const e = normalize(expected);
  if (g === e) return 'correct';
  if (stripAccents(g) === stripAccents(e)) return 'accents';
  return 'wrong';
}

function labelsFor(tenseId, answerCount, verb) {
  if (answerCount === 1) return ['il'];
  if (tenseId === 'imperatif') return IMPERATIF_LABELS;
  if (tenseId === 'gerondif') return GERONDIF_LABELS;
  if (tenseId === 'infinitif') return INFINITIF_LABELS;
  if (tenseId === 'participe') return PARTICIPE_LABELS;
  return PRONOUNS.map(function (p, i) {
    // Show elision hint on "je" when the expected answer starts with a vowel sound is not knowable
    // cheaply here, so we show it whenever the stored answer implies it via the parent (handled below)
    return p;
  });
}

export default function VerbSheetV2(props) {
  const item = props.item;            // homework_content row
  const profile = props.profile;      // { id, level, ... }
  const homeworkId = props.homeworkId;
  const cycleNumber = props.cycleNumber;

  const verb = item.prompt;
  const conj = item.extra || {};

  const availableTenses = useMemo(function () {
    return TENSE_ORDER.filter(function (t) { return conj[t.id] !== undefined; });
  }, [conj]);

  const [activeTense, setActiveTense] = useState(null);
  const [inputs, setInputs] = useState({});      // tenseId -> array of strings
  const [attempts, setAttempts] = useState({});  // tenseId -> attempt row
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(function () {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from('verb_attempts')
        .select('*')
        .eq('student_id', profile.id)
        .eq('verb', verb)
        .eq('cycle_number', cycleNumber);
      if (!cancelled) {
        if (!error && data) {
          const map = {};
          data.forEach(function (row) { map[row.tense] = row; });
          setAttempts(map);
        }
        setLoading(false);
      }
    }
    load();
    return function () { cancelled = true; };
  }, [profile.id, verb, cycleNumber]);

  useEffect(function () {
    if (!activeTense && availableTenses.length > 0) {
      setActiveTense(availableTenses[0].id);
    }
  }, [availableTenses, activeTense]);

  if (loading) return <div className="card">Loading verb test...</div>;
  if (!activeTense) return null;

  const tense = TENSES.find(function (t) { return t.id === activeTense; });
  const expected = conj[activeTense] || [];
  const attempt = attempts[activeTense];
  const isLocked = Boolean(attempt);
  const tenseUnlocked = profile.level >= tense.level || profile.is_teacher_unlocked;
  const labels = labelsFor(activeTense, expected.length, verb);

  const currentInputs = inputs[activeTense] || expected.map(function () { return ''; });
  const allFilled = currentInputs.every(function (v) { return normalize(v).length > 0; });

  function setInput(idx, value) {
    const next = currentInputs.slice();
    next[idx] = value;
    setInputs(Object.assign({}, inputs, { [activeTense]: next }));
  }

  async function handleSubmit() {
    if (!allFilled || isLocked || submitting) return;
    setSubmitting(true);
    const results = currentInputs.map(function (given, i) {
      return gradeAnswer(given, expected[i]);
    });
    const correctCount = results.filter(function (r) { return r !== 'wrong'; }).length;
    const answersJson = {};
    currentInputs.forEach(function (given, i) {
      answersJson[i] = { given: given, expected: expected[i], result: results[i] };
    });
    const row = {
      student_id: profile.id,
      homework_id: homeworkId,
      verb: verb,
      tense: activeTense,
      cycle_number: cycleNumber,
      correct_count: correctCount,
      total: expected.length,
      answers: answersJson,
    };
    const { data, error } = await supabase
      .from('verb_attempts')
      .insert(row)
      .select()
      .single();
    if (!error && data) {
      setAttempts(Object.assign({}, attempts, { [activeTense]: data }));
    }
    setSubmitting(false);
  }

  function pronounLabel(idx) {
    // Elision hint: expected answer starting with vowel/h and pronoun je
    if (labels[idx] === 'je' && expected[idx] && /^[aeéèêiouh]/i.test(expected[idx])) {
      return "je (j')";
    }
    return labels[idx];
  }

  return (
    <div className="card verb-sheet-v2">
      <div className="vs2-header">
        <strong>{verb}</strong>
        <span className="vs2-score-summary">
          {Object.keys(attempts).length} / {availableTenses.length} tenses done
        </span>
      </div>

      <div className="vs2-pills">
        {availableTenses.map(function (t) {
          const done = attempts[t.id];
          const unlocked = profile.level >= t.level;
          const cls = [
            'vs2-pill',
            t.id === activeTense ? 'active' : '',
            done ? 'done' : '',
            !unlocked ? 'locked' : '',
          ].join(' ');
          return (
            <button
              key={t.id}
              className={cls}
              onClick={function () { setActiveTense(t.id); }}
            >
              {t.label}
              {done ? ' (' + done.correct_count + '/' + done.total + ')' : ''}
              {!unlocked ? ' [L' + t.level + ']' : ''}
            </button>
          );
        })}
      </div>

      {!tenseUnlocked && !isLocked ? (
        <div className="vs2-locked-msg">
          Unlocks at Level {tense.level}. Ask your teacher for early access.
        </div>
      ) : (
        <div className="vs2-grid">
          {expected.map(function (ans, idx) {
            const saved = attempt ? attempt.answers[idx] : null;
            const result = saved ? saved.result : null;
            return (
              <div className="vs2-row" key={idx}>
                <span className="vs2-pronoun">{pronounLabel(idx)}</span>
                <input
                  className={'vs2-input' + (result ? ' ' + result : '')}
                  value={saved ? saved.given : currentInputs[idx]}
                  disabled={isLocked}
                  onChange={function (e) { setInput(idx, e.target.value); }}
                />
                {isLocked ? (
                  <span className={'vs2-correction ' + result}>
                    {result === 'correct' ? 'Correct' : ans}
                    {result === 'accents' ? ' — watch your accents' : ''}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {tenseUnlocked && !isLocked ? (
        <button
          className="btn-primary vs2-submit"
          disabled={!allFilled || submitting}
          onClick={handleSubmit}
        >
          {submitting ? 'Submitting...' : allFilled ? 'Submit ' + tense.label : 'Fill all boxes to submit'}
        </button>
      ) : null}
      {isLocked ? (
        <div className="vs2-final-score">
          Score: {attempt.correct_count} / {attempt.total} — locked
        </div>
      ) : null}
    </div>
  );
}