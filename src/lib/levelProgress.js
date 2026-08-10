import { supabase } from './supabase';
import { computeWeeklyCompletion } from './weeklyCompletion';

// LEVEL AUTO-UNLOCK SYSTEM
// All thresholds live here. Tune numbers without touching components.
export var LEVEL_CONFIG = {
  completionBar: 70,          // a week "counts" at >= this %
  l3ConsecutiveWeeks: 2,      // L2 -> L3
  l4ConsecutiveWeeks: 4,      // counted at Level 3 only
  l4MasteryWeeks: 3,          // any 3 snapshot weeks with mastery passed
  masteryTensePct: 80,        // avg best score per tense
  masteryMinVerbs: 40,        // distinct verbs attempted per tense
  mondayAvgTarget: 80,        // avg of 2 most recent evaluations
  mondayCount: 2,
  l3Tenses: [
    'present', 'imparfait', 'futur simple', 'passe compose',
    'plus-que-parfait', 'futur anterieur',
    'conditionnel present', 'conditionnel passe'
  ]
};

function normTense(t) {
  if (!t) return '';
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// ---- Verb mastery check (all 8 L3 tenses: avg best pct >= 80, >= 40 verbs each)
export async function checkVerbMastery(studentId) {
  var res = await supabase
    .from('verb_attempts')
    .select('verb, tense, correct_count, total')
    .eq('student_id', studentId);
  if (res.error || !res.data) {
    return { passed: false, tenses: {} };
  }
  var byTense = {};
  var i;
  for (i = 0; i < res.data.length; i++) {
    var row = res.data[i];
    var tn = normTense(row.tense);
    if (LEVEL_CONFIG.l3Tenses.indexOf(tn) === -1) continue;
    if (!byTense[tn]) byTense[tn] = {};
    var pct = row.total > 0 ? (row.correct_count / row.total) * 100 : 0;
    if (byTense[tn][row.verb] === undefined || pct > byTense[tn][row.verb]) {
      byTense[tn][row.verb] = pct; // best attempt per verb+tense
    }
  }
  var tenses = {};
  var allPass = true;
  for (i = 0; i < LEVEL_CONFIG.l3Tenses.length; i++) {
    var t = LEVEL_CONFIG.l3Tenses[i];
    var verbs = byTense[t] ? Object.keys(byTense[t]) : [];
    var sum = 0;
    var j;
    for (j = 0; j < verbs.length; j++) sum += byTense[t][verbs[j]];
    var avg = verbs.length > 0 ? sum / verbs.length : 0;
    var pass =
      verbs.length >= LEVEL_CONFIG.masteryMinVerbs &&
      avg >= LEVEL_CONFIG.masteryTensePct;
    tenses[t] = { verbCount: verbs.length, avgPct: Math.round(avg), passed: pass };
    if (!pass) allPass = false;
  }
  return { passed: allPass, tenses: tenses };
}

// ---- Monday evaluations: avg of 2 most recent >= 80
export async function checkMondayAverage(studentId) {
  var res = await supabase
    .from('monday_evaluations')
    .select('score, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(LEVEL_CONFIG.mondayCount);
  if (res.error || !res.data || res.data.length < LEVEL_CONFIG.mondayCount) {
    return { passed: false, avg: null, count: res.data ? res.data.length : 0 };
  }
  var sum = 0;
  var i;
  for (i = 0; i < res.data.length; i++) sum += Number(res.data[i].score || 0);
  var avg = sum / res.data.length;
  return { passed: avg >= LEVEL_CONFIG.mondayAvgTarget, avg: Math.round(avg), count: res.data.length };
}

// ---- Streak helpers over snapshots (newest first)
function consecutiveFromLatest(rows, levelFilter) {
  var streak = 0;
  var i;
  for (i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (levelFilter !== null && Number(r.level_at_snapshot) !== levelFilter) break;
    if (Number(r.completion_pct) >= LEVEL_CONFIG.completionBar) streak++;
    else break;
  }
  return streak;
}

export async function getSnapshots(studentId) {
  var res = await supabase
    .from('level_week_snapshots')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  return res.data || [];
}

// ---- Full read-only progress for cards / My Results
export async function getLevelProgress(studentId, level) {
  var lvl = Number(level);
  if (lvl >= 4) return { level: lvl, done: true };

  var snaps = await getSnapshots(studentId);

  if (lvl < 3) {
    var streak3 = consecutiveFromLatest(snaps, null);
    var remaining3 = Math.max(0, LEVEL_CONFIG.l3ConsecutiveWeeks - streak3);
    return {
      level: lvl,
      target: 3,
      done: false,
      criteria: [
        {
          key: 'weeks',
          label: 'Consecutive weeks at 70%+',
          current: streak3,
          targetVal: LEVEL_CONFIG.l3ConsecutiveWeeks,
          met: streak3 >= LEVEL_CONFIG.l3ConsecutiveWeeks
        }
      ],
      weeksRemaining: remaining3,
      snapshots: snaps
    };
  }

  // Level 3 -> 4
  var l3snaps = [];
  var i;
  for (i = 0; i < snaps.length; i++) {
    if (Number(snaps[i].level_at_snapshot) === 3) l3snaps.push(snaps[i]);
  }
  var streak4 = consecutiveFromLatest(snaps, 3);
  var masteryWeeks = 0;
  for (i = 0; i < l3snaps.length; i++) {
    if (l3snaps[i].mastery_passed) masteryWeeks++;
  }
  var monday = await checkMondayAverage(studentId);
  var masteryNow = await checkVerbMastery(studentId);

  var remWeeks = Math.max(0, LEVEL_CONFIG.l4ConsecutiveWeeks - streak4);
  var remMastery = masteryNow.passed
    ? Math.max(0, LEVEL_CONFIG.l4MasteryWeeks - masteryWeeks)
    : Math.max(1, LEVEL_CONFIG.l4MasteryWeeks - masteryWeeks);
  var remMonday = monday.passed ? 0 : 1;
  var weeksRemaining = Math.max(remWeeks, remMastery, remMonday);

  return {
    level: lvl,
    target: 4,
    done: false,
    criteria: [
      {
        key: 'weeks',
        label: 'Consecutive weeks at 70%+ (Level 3)',
        current: streak4,
        targetVal: LEVEL_CONFIG.l4ConsecutiveWeeks,
        met: streak4 >= LEVEL_CONFIG.l4ConsecutiveWeeks
      },
      {
        key: 'mastery',
        label: 'Weeks with all 8 tenses mastered',
        current: masteryWeeks,
        targetVal: LEVEL_CONFIG.l4MasteryWeeks,
        met: masteryWeeks >= LEVEL_CONFIG.l4MasteryWeeks,
        detail: masteryNow
      },
      {
        key: 'monday',
        label: 'Monday evaluations avg (last 2)',
        current: monday.avg === null ? 0 : monday.avg,
        targetVal: LEVEL_CONFIG.mondayAvgTarget,
        met: monday.passed
      }
    ],
    weeksRemaining: weeksRemaining,
    snapshots: snaps
  };
}

// ---- Projected unlock date
export function projectUnlockDate(weekStartedOn, weeksRemaining) {
  if (!weekStartedOn || weeksRemaining <= 0) return null;
  var d = new Date(weekStartedOn + 'T00:00:00');
  d.setDate(d.getDate() + 7 * (weeksRemaining + 1)); // unlock happens at next advance after final week
  return d;
}

// ---- Advance Week: snapshot + unlock every student. Teacher session only.
export async function snapshotAndUnlockAll(currentHomeworkId, cycleNumber) {
  var out = { snapshots: 0, unlocked: [] , errors: [] };
  var studentsRes = await supabase
    .from('profiles')
    .select('id, full_name, level, role')
    .eq('role', 'student');
  if (studentsRes.error || !studentsRes.data) {
    out.errors.push('load students failed');
    return out;
  }
  var students = studentsRes.data;
  var i;
  for (i = 0; i < students.length; i++) {
    var s = students[i];
    var lvl = Number(s.level);
    try {
      var pct = await computeWeeklyCompletion(s.id, currentHomeworkId);
      var mastery = lvl === 3 ? await checkVerbMastery(s.id) : { passed: false };
      var snapRes = await supabase.from('level_week_snapshots').upsert({
        student_id: s.id,
        homework_id: currentHomeworkId,
        cycle_number: cycleNumber,
        completion_pct: pct,
        mastery_passed: mastery.passed,
        level_at_snapshot: lvl
      }, { onConflict: 'student_id,homework_id,cycle_number' });
      if (snapRes.error) {
        out.errors.push(s.full_name + ': snapshot failed');
        continue;
      }
      out.snapshots++;

      if (lvl !== 2 && lvl !== 3) continue;

      // already teacher-unlocked to 4? (level would be 4, skipped above)
      var progress = await getLevelProgress(s.id, lvl);
      var allMet = true;
      var j;
      for (j = 0; j < progress.criteria.length; j++) {
        if (!progress.criteria[j].met) allMet = false;
      }
      if (!allMet) continue;

      var toLevel = lvl === 2 ? 3 : 4;
      var up = await supabase.from('profiles')
        .update({ level: toLevel })
        .eq('id', s.id);
      if (up.error) {
        out.errors.push(s.full_name + ': level update failed');
        continue;
      }
      await supabase.from('level_unlocks').insert({
        student_id: s.id,
        from_level: lvl,
        to_level: toLevel,
        unlocked_by: 'auto',
        criteria_snapshot: { criteria: progress.criteria, cycle_number: cycleNumber, homework_id: currentHomeworkId }
      });
      out.unlocked.push({ name: s.full_name, to: toLevel });
    } catch (e) {
      out.errors.push(s.full_name + ': ' + (e && e.message ? e.message : 'error'));
    }
  }
  return out;
}

// ---- Teacher direct L4 unlock
export async function teacherUnlockL4(studentId, fromLevel) {
  var up = await supabase.from('profiles')
    .update({ level: 4 })
    .eq('id', studentId);
  if (up.error) return { ok: false, error: up.error.message };
  var ins = await supabase.from('level_unlocks').insert({
    student_id: studentId,
    from_level: Number(fromLevel),
    to_level: 4,
    unlocked_by: 'teacher',
    criteria_snapshot: null
  });
  if (ins.error) return { ok: false, error: ins.error.message };
  return { ok: true };
}

// ---- Banner: latest undismissed unlock
export async function getUndismissedUnlock(studentId) {
  var res = await supabase
    .from('level_unlocks')
    .select('*')
    .eq('student_id', studentId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(1);
  if (res.error || !res.data || res.data.length === 0) return null;
  return res.data[0];
}

export async function dismissUnlock(unlockId) {
  await supabase.from('level_unlocks')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', unlockId);
}