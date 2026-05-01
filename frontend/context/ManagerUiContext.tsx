'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

type ManagerUiContextValue = {
  cleaningsTodoCount: number;
  setCleaningsTodoCount: Dispatch<SetStateAction<number>>;
};

const ManagerUiContext = createContext<ManagerUiContextValue | null>(null);

export function ManagerUiProvider({ children }: { children: React.ReactNode }) {
  const [cleaningsTodoCount, setCleaningsTodoCount] = useState(0);

  const value = useMemo(
    () => ({ cleaningsTodoCount, setCleaningsTodoCount }),
    [cleaningsTodoCount],
  );

  return <ManagerUiContext.Provider value={value}>{children}</ManagerUiContext.Provider>;
}

export function useManagerUi() {
  const context = useContext(ManagerUiContext);
  if (!context) {
    throw new Error('useManagerUi must be used within ManagerUiProvider');
  }
  return context;
}
