import { createContext, useContext, useState } from 'react';
import { setReadOnlyMode } from './supabase';

const ViewAsContext = createContext({
  viewAs: null,
  setViewAs: function () {},
});

export function ViewAsProvider(props) {
  const [viewAs, setViewAsState] = useState(null);

  function setViewAs(student) {
    setReadOnlyMode(!!student);
    setViewAsState(student);
  }

  return (
    <ViewAsContext.Provider value={{ viewAs: viewAs, setViewAs: setViewAs }}>
      {props.children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  return useContext(ViewAsContext);
}