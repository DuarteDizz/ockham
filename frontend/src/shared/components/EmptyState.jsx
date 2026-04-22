import React, { useRef } from 'react';
import { UploadCloud } from 'lucide-react';
import OckhamLogo from './OckhamLogo';

export default function EmptyState({ uploadDataset, datasetName }) {
  const fileRef = useRef(null);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (file) await uploadDataset(file);
    event.target.value = '';
  };

  return (
    <div className="flex h-full overflow-y-auto px-4 pb-8 md:px-6">
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="panel-glass max-w-2xl rounded-[28px] p-8 text-center">
          <div className="mx-auto w-fit">
            <OckhamLogo showLabel={false} size="lg" />
          </div>
          <h2 className="mt-6 font-heading text-3xl font-extrabold tracking-[-0.04em] text-foreground">Prepare a clean benchmark run</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            Upload a pre-processed CSV dataset, select at least two candidate models and launch the comparison. Ockham keeps the decision surface focused on what matters.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <input ref={fileRef} type="file" accept=".csv" onChange={handleUpload} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-2xl gradient-primary px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_26px_rgba(10,73,194,0.18)]"
            >
              <UploadCloud className="h-4 w-4" />
              Upload dataset
            </button>
            {datasetName ? <span className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm text-muted-foreground">Current: <span className="font-semibold text-foreground">{datasetName}</span></span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
