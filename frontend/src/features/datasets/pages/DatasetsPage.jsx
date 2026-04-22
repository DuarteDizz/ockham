import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, List, Upload, Database, Trash2, ChevronRight, Search, Plus } from 'lucide-react';
import useOckhamStore from '@/features/workspace/state/WorkspaceContext';

const FILE_TYPE_COLORS = { csv: '#10B981', xlsx: '#4361EE', json: '#F59E0B', parquet: '#7C3AED' };

function DatasetCard({ dataset, onOpen, onDelete, onActivate }) {
  const color = FILE_TYPE_COLORS[dataset.file_type] || '#4361EE';
  const expCount = dataset.experiments?.length || 0;
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} className="group relative panel-glass rounded-2xl border border-white/70 card-shadow hover:card-shadow-md transition-all overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: color }} />
      <div className="p-5">
        <div className="mb-4 flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
            <Database className="w-5 h-5" style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>.{dataset.file_type || 'csv'}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(dataset.id); }} className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-all shrink-0">
                <Trash2 className="w-4 h-4 text-destructive/70" />
              </button>
            </div>
            <h3 className="mt-2 font-heading font-bold text-foreground text-sm truncate">{dataset.name}</h3>
          </div>
        </div>
        {dataset.description ? <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{dataset.description}</p> : null}
        <button type="button" onClick={() => onOpen(dataset.id)} className="block w-full text-left">
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
            {dataset.rows ? <span>{dataset.rows.toLocaleString()} rows</span> : null}
            {dataset.columns ? <span>{dataset.columns} cols</span> : null}
            {dataset.size_kb ? <span>{dataset.size_kb} KB</span> : null}
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-foreground">{expCount > 0 ? `${expCount} experiment${expCount > 1 ? 's' : ''}` : 'No experiments yet'}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </button>
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <button type="button" onClick={() => onActivate(dataset.id)} className="flex-1 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10">Use in Dashboard</button>
      </div>
    </motion.div>
  );
}

function DatasetRow({ dataset, onOpen, onDelete, onActivate }) {
  const color = FILE_TYPE_COLORS[dataset.file_type] || '#4361EE';
  const expCount = dataset.experiments?.length || 0;
  return (
    <motion.div layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="group">
      <div className="flex items-center gap-4 px-5 py-4 panel-glass rounded-xl border border-white/70 hover:border-primary/20 hover:card-shadow transition-all">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
          <Database className="w-4 h-4" style={{ color }} />
        </div>
        <button type="button" onClick={() => onOpen(dataset.id)} className="flex-1 min-w-0 text-left">
          <p className="font-semibold text-sm text-foreground truncate">{dataset.name}</p>
          {dataset.description ? <p className="text-xs text-muted-foreground truncate">{dataset.description}</p> : null}
        </button>
        <div className="hidden sm:flex items-center gap-6 text-xs text-muted-foreground">
          <span>{dataset.rows ? `${dataset.rows.toLocaleString()} rows` : '—'}</span>
          <span>{dataset.columns ? `${dataset.columns} cols` : '—'}</span>
          <span style={{ color }} className="font-semibold uppercase">.{dataset.file_type || 'csv'}</span>
          <span>{expCount} exp{expCount !== 1 ? 's' : ''}</span>
        </div>
        <button type="button" onClick={() => onActivate(dataset.id)} className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10">Use</button>
        <button type="button" onClick={() => onDelete(dataset.id)} className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-all flex-shrink-0">
          <Trash2 className="w-4 h-4 text-destructive/70" />
        </button>
      </div>
    </motion.div>
  );
}

export default function DatasetsPage() {
  const { uploadedDatasets, openDatasetDetail, deleteDataset, openDatasetFromLibrary, uploadDataset, isDatasetsLoading } = useOckhamStore();
  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [uploadKey, setUploadKey] = useState(0);
  const fileRef = useRef(null);

  const filtered = uploadedDatasets.filter((d) => d.name?.toLowerCase().includes(search.toLowerCase()) || d.description?.toLowerCase().includes(search.toLowerCase()));

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadDataset(file);
    e.target.value = '';
    setUploadKey((v) => v + 1);
  };

  return (
    <main className="min-h-full p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-extrabold text-foreground">Datasets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{uploadedDatasets.length} dataset{uploadedDatasets.length !== 1 ? 's' : ''} uploaded</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg">
            <button type="button" onClick={() => setViewMode('grid')} className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-white card-shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}><LayoutGrid className="w-4 h-4" /></button>
            <button type="button" onClick={() => setViewMode('list')} className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-white card-shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}><List className="w-4 h-4" /></button>
          </div>
          <input key={uploadKey} ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white font-bold text-sm shadow-lg shadow-primary/25 hover:opacity-90 transition-all"><Plus className="w-4 h-4" /> Upload Dataset</button>
        </div>
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search datasets..." className="w-full bg-white border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors card-shadow" />
      </div>

      {isDatasetsLoading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4"><Database className="w-7 h-7 text-muted-foreground" /></div>
          <h3 className="text-base font-heading font-bold text-foreground mb-1">No datasets yet</h3>
          <p className="text-sm text-muted-foreground mb-5">Upload your first dataset to get started</p>
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white font-bold text-sm shadow-lg shadow-primary/25 hover:opacity-90 transition-all"><Upload className="w-4 h-4" /> Upload Dataset</button>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((d) => <DatasetCard key={d.id} dataset={d} onOpen={openDatasetDetail} onDelete={deleteDataset} onActivate={openDatasetFromLibrary} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((d) => <DatasetRow key={d.id} dataset={d} onOpen={openDatasetDetail} onDelete={deleteDataset} onActivate={openDatasetFromLibrary} />)}
            </div>
          )}
        </AnimatePresence>
      )}
    </main>
  );
}
