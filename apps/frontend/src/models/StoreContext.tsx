import React, { createContext, useContext } from 'react';
import { createRootStore, IRootStore } from './RootStore';

const rootStoreInstance = createRootStore();

const StoreContext = createContext<IRootStore>(rootStoreInstance);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <StoreContext.Provider value={rootStoreInstance}>
      {children}
    </StoreContext.Provider>
  );
};

export function useStore(): IRootStore {
  return useContext(StoreContext);
}
