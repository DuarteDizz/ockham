import { WorkspaceProvider } from '@/features/workspace/state/WorkspaceContext';
import AppShell from '@/shared/layout/AppShell';

export default function App() {
  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  );
}
