import { useState, useEffect } from 'react';
import { getCompletedChallengeIds } from '../lib/challengeUnlocks';

export default function ChallengesDoneCard(props) {
  var profile = props.profile;
  var [count, setCount] = useState(null);

  useEffect(function () {
    if (!profile) return;
    getCompletedChallengeIds(profile.id).then(function (ids) {
      setCount(ids.length);
    });
  }, [profile]);

  return (
    <div className="card cl-stat">
      <div className="stat-value">{count === null ? '-' : count}</div>
      <div className="stat-label">Challenges completed</div>
    </div>
  );
}