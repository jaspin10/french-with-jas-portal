import { supabase } from './supabase';

var WEAKNESS_WEEKS = 4;
var WEAKNESS_MIN_COUNT = 3;

export async function getWeaknessTags(profileId) {
  var tags = {};

  var mondayTags = await getMondayEvalTags(profileId);
  mergeTags(tags, mondayTags);

  // Future weakness sources plug in here:
  // mergeTags(tags, await getOralTags(profileId));
  // mergeTags(tags, await getListeningTags(profileId));
  // mergeTags(tags, await getWritingTags(profileId));

  var result = [];
  var keys = Object.keys(tags);
  for (var i = 0; i < keys.length; i++) {
    if (tags[keys[i]] >= WEAKNESS_MIN_COUNT) result.push(keys[i]);
  }
  return result;
}

async function getMondayEvalTags(profileId) {
  var res = await supabase
    .from('monday_evaluations')
    .select('mistake_counts, created_at')
    .eq('student_id', profileId)
    .order('created_at', { ascending: false })
    .limit(WEAKNESS_WEEKS);

  if (res.error || !res.data) return {};

  var tags = {};
  for (var i = 0; i < res.data.length; i++) {
    var counts = res.data[i].mistake_counts || {};
    var keys = Object.keys(counts);
    for (var j = 0; j < keys.length; j++) {
      var k = keys[j];
      var n = Number(counts[k]) || 0;
      tags[k] = (tags[k] || 0) + n;
    }
  }
  return tags;
}

function mergeTags(target, source) {
  var keys = Object.keys(source || {});
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    target[k] = (target[k] || 0) + source[k];
  }
}

export function isChallengeUnlocked(challenge, weaknessTags) {
  if (challenge.pool === 'free') return true;
  var unlockTags = challenge.unlock_tags || [];
  for (var i = 0; i < unlockTags.length; i++) {
    if (weaknessTags.indexOf(unlockTags[i]) !== -1) return true;
  }
  return false;
}

function isFreeOrder(challenge) {
  var extra = challenge.extra || {};
  return extra.free_order === true;
}

export function buildExerciseStates(challengesInGroup, completedIds) {
  var sorted = challengesInGroup.slice().sort(function (a, b) {
    return a.position - b.position;
  });

  var states = {};
  var previousDone = true;
  for (var i = 0; i < sorted.length; i++) {
    var c = sorted[i];
    var done = completedIds.indexOf(c.id) !== -1;
    var free = isFreeOrder(c);
    var state;
    if (done) state = 'completed';
    else if (free || previousDone) state = 'open';
    else state = 'locked';
    states[c.id] = state;
    previousDone = done || free;
  }
  return states;
}

export async function getCompletedChallengeIds(profileId) {
  var res = await supabase
    .from('challenge_attempts')
    .select('challenge_id')
    .eq('student_id', profileId)
    .eq('accepted', true);

  if (res.error || !res.data) return [];

  var ids = [];
  for (var i = 0; i < res.data.length; i++) {
    var id = res.data[i].challenge_id;
    if (ids.indexOf(id) === -1) ids.push(id);
  }
  return ids;
}