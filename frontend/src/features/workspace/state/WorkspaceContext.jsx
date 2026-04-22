import { createContext, useContext } from 'react';

import { useWorkspaceController } from '@/features/workspace/state/useWorkspaceController';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const value = useWorkspaceController();
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export default function useOckhamStore() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useOckhamStore must be used within WorkspaceProvider');
  return context;
}

