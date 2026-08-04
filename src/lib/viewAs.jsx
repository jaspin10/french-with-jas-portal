import { createContext, useContext, useState } from 'react';

const ViewAsContext = createContext({
  viewAs: null,
  setViewAs: function () {},
});

export function ViewAsProvider(props) {
  const [viewAs, setViewAs] = useState(null);
  return (
    <ViewAsContext.Provider value={{ viewAs: viewAs, setViewAs: setViewAs }}>
      {props.children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  return useContext(ViewAsContext);
}