import { supabase } from './supabase';

var SET_SIZE = 10;

function levelAllows(item, level) {
  if (item.min_level !== null && item.min_level !== undefined && level < item.min_level) return false;
  if (item.max_level !== null && item.max_level !== undefined && level > item.max_level) return false;
  return true;
}

function trackAllows(item, track) {
  if (track !== 'oral_only') return true;
  if (item.skill_tag === 'reading' || item.skill_tag === 'writing') return false;
  return true;
}

// Returns { theme, done, total, percent }
export async function getWeeklyCompletion(profile) {
  var result = { theme: '', done: 0, total: 0, percent: 0 };

  var gc = await supabase.from('global_cycle').select('*').eq('id', 1).single();
  if (!gc.data) return result;
  var homeworkId = gc.data.current_homework_id;
  var cycleNumber = gc.data.cycle_number;
  var weekStart = gc.data.week_started_on;

  var hw = await supabase.from('homeworks').select('theme').eq('id', homeworkId).single();
  if (hw.data) result.theme = hw.data.theme;

  var content = await supabase
    .from('homework_content')
    .select('*')
    .eq('homework_id', homeworkId)
    .order('day')
    .order('block')
    .order('position');
  if (!content.data) return result;

  var items = [];
  var i;
  for (i = 0; i < content.data.length; i++) {
    var it = content.data[i];
    if (levelAllows(it, profile.level) && trackAllows(it, profile.track)) items.push(it);
  }

  // Fetch attempts in parallel
  var results = await Promise.all([
    supabase.from('verb_attempts').select('verb, tense').eq('student_id', profile.id).eq('homework_id', homeworkId).eq('cycle_number', cycleNumber),
    supabase.from('drill_attempts').select('day, block, set_no').eq('student_id', profile.id).eq('homework_id', homeworkId),
    supabase.from('item_attempts').select('content_id').eq('student_id', profile.id),
    supabase.from('rapid_fire_attempts').select('content_id').eq('student_id', profile.id).eq('cycle_number', cycleNumber).eq('accepted', true),
    supabase.from('image_describe_attempts').select('content_id, step_no').eq('student_id', profile.id).eq('cycle_number', cycleNumber).eq('accepted', true),
    supabase.from('process_attempts').select('content_id, step_no').eq('student_id', profile.id).eq('cycle_number', cycleNumber).eq('accepted', true),
    supabase.from('submissions').select('homework_id, kind, submitted_at').eq('student_id', profile.id).eq('homework_id', homeworkId).eq('kind', 'writing').gte('submitted_at', weekStart)
  ]);

  var verbRows = results[0].data || [];
  var drillRows = results[1].data || [];
  var itemRows = results[2].data || [];
  var rfRows = results[3].data || [];
  var idRows = results[4].data || [];
  var prRows = results[5].data || [];
  var writingRows = results[6].data || [];

  var verbDone = {};
  for (i = 0; i < verbRows.length; i++) verbDone[verbRows[i].verb] = true;

  var drillDone = {};
  for (i = 0; i < drillRows.length; i++) {
    drillDone[drillRows[i].day + '|' + drillRows[i].block + '|' + drillRows[i].set_no] = true;
  }

  var itemDone = {};
  for (i = 0; i < itemRows.length; i++) itemDone[itemRows[i].content_id] = true;

  var rfDone = {};
  for (i = 0; i < rfRows.length; i++) rfDone[rfRows[i].content_id] = true;

  var idDone = {};
  for (i = 0; i < idRows.length; i++) idDone[idRows[i].content_id + '|' + idRows[i].step_no] = true;

  var prDone = {};
  for (i = 0; i < prRows.length; i++) {
    var key = prRows[i].content_id + '|' + (prRows[i].step_no === null ? 'full' : prRows[i].step_no);
    prDone[key] = true;
  }

  var hasWriting = writingRows.length > 0;

  var done = 0;
  var total = 0;

  // Group plain solve items (non one-by-one) into drill sets per day+block
  var drillCounts = {}; // day|block -> count of solve items
  for (i = 0; i < items.length; i++) {
    var item = items[i];
    var extra = item.extra || {};

    if (item.item_type === 'verb_sheet') {
      total += 1;
      var verbName = item.prompt;
      if (verbDone[verbName]) done += 1;

    } else if (item.item_type === 'solve') {
      if (extra.mode === 'one_by_one') {
        // Ladder item: one unit per item
        total += 1;
        if (itemDone[item.id]) done += 1;
      } else {
        var dk = item.day + '|' + item.block;
        drillCounts[dk] = (drillCounts[dk] || 0) + 1;
      }

    } else if (item.item_type === 'rapid_fire') {
      total += 1;
      if (rfDone[item.id]) done += 1;

    } else if (item.item_type === 'image_describe') {
      var steps = extra.steps || [];
      var s;
      for (s = 0; s < steps.length; s++) {
        total += 1;
        if (idDone[item.id + '|' + steps[s].step]) done += 1;
      }

    } else if (item.item_type === 'process_telling') {
      if (extra.mode === 'all_at_once') {
        total += 1;
        if (prDone[item.id + '|full']) done += 1;
      } else {
        var psteps = extra.steps || [];
        var p;
        for (p = 0; p < psteps.length; p++) {
          total += 1;
          if (prDone[item.id + '|' + (p + 1)]) done += 1;
        }
      }

    } else if (item.item_type === 'writing') {
      total += 1;
      if (hasWriting) done += 1;
    }
    // instructions, video, reading, audio_task: no completion signal, not counted
  }

  // Convert grouped solve items into sets of 10
  var dkKey;
  for (dkKey in drillCounts) {
    var parts = dkKey.split('|');
    var day = parts[0];
    var block = parseInt(parts[1], 10);
    var sets = Math.ceil(drillCounts[dkKey] / SET_SIZE);
    var n;
    for (n = 1; n <= sets; n++) {
      total += 1;
      if (drillDone[day + '|' + block + '|' + n]) done += 1;
    }
  }

  result.done = done;
  result.total = total;
  result.percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return result;
}