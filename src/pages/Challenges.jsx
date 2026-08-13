import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  getWeaknessTags,
  isChallengeUnlocked,
  buildExerciseStates,
  getCompletedChallengeIds
} from '../lib/challengeUnlocks';
import ChallengeRapidFire from '../components/ChallengeRapidFire';

var TYPE_LABELS = {
  rapid_fire: 'Rapid Fire',
  translation: 'Translations',
  vocabulary: 'Vocabulary',
  spelling: 'Spelling'
};

export default function Challenges(props) {
  var profile = props.profile;

  var [loading, setLoading] = useState(true);
  var [challenges, setChallenges] = useState([]);
  var [weaknessTags, setWeaknessTags] = useState([]);
  var [completedIds, setCompletedIds] = useState([]);

  var [selectedType, setSelectedType] = useState(null);
  var [selectedCategory, setSelectedCategory] = useState(null);
  var [selectedChallenge, setSelectedChallenge] = useState(null);

  useEffect(function () {
    if (!profile) return;
    loadAll();
  }, [profile]);

  async function loadAll() {
    setLoading(true);
    var chRes = await supabase
      .from('challenges')
      .select('*')
      .order('category', { ascending: true })
      .order('level', { ascending: true })
      .order('position', { ascending: true });

    var tags = await getWeaknessTags(profile.id);
    var done = await getCompletedChallengeIds(profile.id);

    setChallenges(chRes.data || []);
    setWeaknessTags(tags);
    setCompletedIds(done);
    setLoading(false);
  }

  function refreshCompleted() {
    getCompletedChallengeIds(profile.id).then(function (done) {
      setCompletedIds(done);
    });
  }

  function visibleChallenges() {
    var out = [];
    for (var i = 0; i < challenges.length; i++) {
      if (isChallengeUnlocked(challenges[i], weaknessTags)) out.push(challenges[i]);
      else if (completedIds.indexOf(challenges[i].id) !== -1) out.push(challenges[i]);
    }
    return out;
  }

  function typesList() {
    var vis = visibleChallenges();
    var types = [];
    for (var i = 0; i < vis.length; i++) {
      if (types.indexOf(vis[i].challenge_type) === -1) types.push(vis[i].challenge_type);
    }
    return types;
  }

  function categoriesForType(type) {
    var vis = visibleChallenges();
    var cats = [];
    for (var i = 0; i < vis.length; i++) {
      if (vis[i].challenge_type !== type) continue;
      if (cats.indexOf(vis[i].category) === -1) cats.push(vis[i].category);
    }
    return cats;
  }

  function exercisesFor(type, category) {
    var vis = visibleChallenges();
    var out = [];
    for (var i = 0; i < vis.length; i++) {
      if (vis[i].challenge_type === type && vis[i].category === category) out.push(vis[i]);
    }
    return out;
  }

  function countInCategory(type, category) {
    return exercisesFor(type, category).length;
  }

  function countDoneInCategory(type, category) {
    var ex = exercisesFor(type, category);
    var n = 0;
    for (var i = 0; i < ex.length; i++) {
      if (completedIds.indexOf(ex[i].id) !== -1) n++;
    }
    return n;
  }

  function openType(type) { setSelectedType(type); }
  function openCategory(cat) { setSelectedCategory(cat); }
  function openChallenge(ch) { setSelectedChallenge(ch); }

  function goBack() {
    if (selectedChallenge) { setSelectedChallenge(null); refreshCompleted(); return; }
    if (selectedCategory) { setSelectedCategory(null); return; }
    if (selectedType) { setSelectedType(null); return; }
  }

  if (loading) {
    return <div className="page"><p className="muted">Loading challenges...</p></div>;
  }

  var types = typesList();

  return (
    <div className="page challenges-page">
      <div className="ch-header">
        {(selectedType || selectedCategory || selectedChallenge) ? (
          <button className="ch-back" onClick={goBack}>Back</button>
        ) : null}
        <h2>
          {selectedChallenge ? selectedChallenge.title
            : selectedCategory ? selectedCategory
            : selectedType ? (TYPE_LABELS[selectedType] || selectedType)
            : 'Challenges'}
        </h2>
      </div>

      {!selectedType ? (
        <div className="ch-grid">
          {types.length === 0 ? <p className="muted">No challenges available yet. Check back soon!</p> : null}
          {types.map(function (type) {
            return (
              <button key={type} className="ch-card" onClick={function () { openType(type); }}>
                <div className="ch-card-title">{TYPE_LABELS[type] || type}</div>
                <div className="ch-card-sub">{categoriesForType(type).length} categories</div>
              </button>
            );
          })}
        </div>
      ) : null}

      {selectedType && !selectedCategory ? (
        <div className="ch-grid">
          {categoriesForType(selectedType).map(function (cat) {
            return (
              <button key={cat} className="ch-card" onClick={function () { openCategory(cat); }}>
                <div className="ch-card-title">{cat}</div>
                <div className="ch-card-sub">
                  {countDoneInCategory(selectedType, cat)} / {countInCategory(selectedType, cat)} completed
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {selectedType && selectedCategory && !selectedChallenge ? (
        <ExerciseList
          exercises={exercisesFor(selectedType, selectedCategory)}
          completedIds={completedIds}
          onOpen={openChallenge}
        />
      ) : null}

      {selectedChallenge ? (
        <ChallengeView
          challenge={selectedChallenge}
          profile={profile}
          onCompleted={refreshCompleted}
        />
      ) : null}
    </div>
  );
}

function ExerciseList(props) {
  var states = buildExerciseStates(props.exercises, props.completedIds);

  return (
    <div className="ch-exercise-list">
      {props.exercises.map(function (ex) {
        var state = states[ex.id];
        var locked = state === 'locked';
        var completed = state === 'completed';
        return (
          <button
            key={ex.id}
            className={'ch-exercise' + (locked ? ' locked' : '') + (completed ? ' completed' : '')}
            disabled={locked}
            onClick={function () { if (!locked) props.onOpen(ex); }}
          >
            <span className="ch-ex-pos">{ex.position}</span>
            <span className="ch-ex-title">{ex.title}</span>
            <span className="ch-ex-state">
              {completed ? 'Done' : locked ? 'Locked' : 'Open'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ChallengeView(props) {
  if (props.challenge.challenge_type === 'rapid_fire') {
    return (
      <ChallengeRapidFire
        challenge={props.challenge}
        profile={props.profile}
        onCompleted={props.onCompleted}
      />
    );
  }
  return <p className="muted">This challenge type is not available yet.</p>;
}