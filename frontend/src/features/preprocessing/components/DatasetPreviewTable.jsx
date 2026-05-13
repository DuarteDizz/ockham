import React, { useMemo, useState } from 'react';
import { AlertTriangle, Database, Eye, Loader2, Search } from 'lucide-react';

function formatCellValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('en-US') : '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getColumnPreviewStats(rows, columnName) {
  if (!rows.length || !columnName) {
    return { missing: 0, observed: 0, unique: 0 };
  }

  const values = rows.map((row) => row?.[columnName]);
  const observedValues = values.filter((value) => value !== null && value !== undefined && value !== '');

  return {
    missing: values.length - observedValues.length,
    observed: observedValues.length,
    unique: new Set(observedValues.map((value) => String(value))).size,
  };
}

export default function DatasetPreviewTable({
  datasetName,
  rows = [],
  columns = [],
  rowCount = 0,
  isLoading = false,
  error = '',
  selectedColumn = '',
  onSelectColumn,
}) {
  const [search, setSearch] = useState('');

  const allColumns = useMemo(() => {
    if (Array.isArray(columns) && columns.length) return columns;
    if (!rows.length) return [];
    return Object.keys(rows[0] || {});
  }, [columns, rows]);

  const visibleColumns = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return allColumns;
    return allColumns.filter((columnName) => columnName.toLowerCase().includes(query));
  }, [allColumns, search]);

  const selectedPreviewStats = useMemo(
    () => getColumnPreviewStats(rows, selectedColumn),
    [rows, selectedColumn],
  );

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[520px] flex-col items-center justify-center rounded-[28px] border border-white/70 bg-white/65 p-10 text-center shadow-sm backdrop-blur-xl">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <p className="font-heading text-sm font-extrabold text-foreground">Loading dataset preview</p>
        <p className="mt-1 text-xs text-muted-foreground">Reading the first rows from the uploaded file.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[520px] flex-col items-center justify-center rounded-[28px] border border-red-100 bg-red-50/80 p-10 text-center shadow-sm backdrop-blur-xl">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-red-100 text-red-500">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="font-heading text-sm font-extrabold text-foreground">Could not load dataset preview</p>
        <p className="mt-1 max-w-[420px] text-xs text-red-500/80">{error}</p>
      </div>
    );
  }

  if (!allColumns.length) {
    return (
      <div className="flex h-full min-h-[520px] flex-col items-center justify-center rounded-[28px] border border-white/70 bg-white/65 p-10 text-center shadow-sm backdrop-blur-xl">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
          <Database className="h-6 w-6" />
        </div>
        <p className="font-heading text-sm font-extrabold text-foreground">No preview data available</p>
        <p className="mt-1 max-w-[420px] text-xs text-muted-foreground">The dataset metadata is available, but no preview rows were returned by the backend.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/65 shadow-sm backdrop-blur-xl">
      <div className="flex flex-col gap-3 border-b border-white/70 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Eye className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-heading font-extrabold text-foreground">Dataset preview</p>
              <p className="truncate text-xs text-muted-foreground" title={datasetName}>{datasetName}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-2xl border border-white/70 bg-white/70 px-3 py-2 text-xs font-semibold text-muted-foreground">
            Showing <span className="font-bold text-foreground">{rows.length}</span>{rowCount ? ` of ${rowCount.toLocaleString('en-US')}` : ''} rows
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/70 px-3 py-2 text-xs font-semibold text-muted-foreground">
            <span className="font-bold text-foreground">{visibleColumns.length}</span> columns visible
          </div>
          {selectedColumn ? (
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary">
              {selectedColumn}: {selectedPreviewStats.observed} observed · {selectedPreviewStats.missing} missing · {selectedPreviewStats.unique} unique
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-white/70 px-5 py-3">
        <p className="text-xs text-muted-foreground">Click a column header to inspect its preprocessing plan and stats.</p>
        <div className="relative flex-none">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search columns..."
            className="w-56 rounded-2xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-xs font-medium outline-none transition-colors focus:border-primary/40"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xl">
            <tr>
              <th className="w-16 border-b border-slate-100 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Row</th>
              {visibleColumns.map((columnName) => {
                const isSelected = selectedColumn === columnName;
                return (
                  <th
                    key={columnName}
                    onClick={() => onSelectColumn?.(columnName)}
                    className={`max-w-[220px] cursor-pointer border-b border-slate-100 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${isSelected ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/[0.06] hover:text-foreground'}`}
                    title={columnName}
                  >
                    <span className="block truncate">{columnName}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`preview-row-${rowIndex}`} className="border-b border-slate-100 transition-colors hover:bg-primary/[0.035]">
                <td className="bg-white/45 px-4 py-3 font-heading font-bold text-muted-foreground">{rowIndex + 1}</td>
                {visibleColumns.map((columnName) => {
                  const isSelected = selectedColumn === columnName;
                  const value = formatCellValue(row?.[columnName]);
                  return (
                    <td
                      key={`${rowIndex}-${columnName}`}
                      onClick={() => onSelectColumn?.(columnName)}
                      className={`max-w-[260px] cursor-pointer px-4 py-3 font-medium transition-colors ${isSelected ? 'bg-primary/[0.045] text-foreground' : 'text-muted-foreground'}`}
                      title={value}
                    >
                      <span className="block truncate">{value}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
