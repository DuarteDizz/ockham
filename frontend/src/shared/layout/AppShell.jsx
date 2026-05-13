import React from 'react';
import useOckhamStore from '@/features/workspace/state/WorkspaceContext';
import Sidebar from '@/features/experiments/components/Sidebar';
import TopHeader from '@/features/experiments/components/TopHeader';
import Dashboard from '@/features/experiments/pages/Dashboard';
import DatasetsPage from '@/features/datasets/pages/DatasetsPage';
import DatasetDetailPage from '@/features/datasets/pages/DatasetDetailPage';
import PreprocessingPage from '@/features/preprocessing/pages/PreprocessingPage';

function MobileNav() {
  const { activeView, setActiveView } = useOckhamStore();
  const activeKey = activeView === 'dataset-detail' ? 'datasets' : activeView;
  const items = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'datasets', label: 'Datasets' },
    { key: 'preprocessing', label: 'Preprocessing' },
  ];

  return (
    <div className="fixed bottom-4 left-4 right-4 z-30 lg:hidden">
      <div className="panel-glass flex items-center justify-between rounded-2xl px-2 py-2">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveView(item.key)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${activeKey === item.key ? 'gradient-primary text-white' : 'text-muted-foreground'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AppShell() {
  const store = useOckhamStore();

  const viewMap = {
    dashboard: <Dashboard />,
    datasets: <DatasetsPage />,
    'dataset-detail': <DatasetDetailPage />,
    preprocessing: <PreprocessingPage />,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        problemType={store.problemType}
        setProblemType={store.setProblemType}
        targetColumn={store.targetColumn}
        setTargetColumn={store.setTargetColumn}
        datasetColumns={store.datasetColumns}
        models={store.models}
        selectedModels={store.selectedModels}
        toggleModel={store.toggleModel}
        selectAllModels={store.selectAllModels}
        clearModels={store.clearModels}
        status={store.status}
        runComparison={store.runComparison}
        resetExperiment={store.resetExperiment}
        datasetName={store.datasetName}
        activeView={store.activeView}
        setActiveView={store.setActiveView}
        openPreprocessing={store.openPreprocessing}
        error={store.error}
        isCancellingExperiment={store.isCancellingExperiment}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="px-4 pt-4 md:px-6">
          <TopHeader
            datasetName={store.datasetName}
            status={store.status}
            problemType={store.problemType}
            setProblemType={store.setProblemType}
            rankingMode={store.rankingMode}
            setRankingMode={store.setRankingMode}
            activeView={store.activeView}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{viewMap[store.activeView] || <Dashboard />}</div>
      </div>

      <MobileNav />
    </div>
  );
}
