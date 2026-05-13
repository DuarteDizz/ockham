import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Database, GitBranch, Grip, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { STEP_META, TYPE_META, getEffectiveTypeFromColumnPlan } from '@/features/preprocessing/support/preprocessingPlan';

const CARD_WIDTH = 232;
const CARD_HEIGHT = 126;
const OP_CARD_WIDTH = 214;
const OP_CARD_HEIGHT = 102;
const INPUT_WIDTH = 280;
const OUTPUT_WIDTH = 250;
const JUNCTION_SIZE = 12;
const BUS_WIDTH = 10;
const OP_STACK_GAP = 18;
const MIN_ROW_HEIGHT = 176;
const TOP_OFFSET = 132;
const ROW_GAP = 34;

const STAGE_X = {
  input: 44,
  column: 380,
  preparation: 704,
  transformation: 1032,
  output: 1412,
};

const STEP_STAGE = {
  cast_numeric: 'preparation',
  cast_datetime: 'preparation',
  cast_categorical: 'preparation',
  cast_text: 'preparation',
  cast_boolean: 'preparation',
  median_imputer: 'preparation',
  mean_imputer: 'preparation',
  most_frequent_imputer: 'preparation',
  constant_imputer: 'preparation',
  drop_column: 'preparation',
  standard_scaler: 'transformation',
  robust_scaler: 'transformation',
  minmax_scaler: 'transformation',
  maxabs_scaler: 'transformation',
  one_hot_encoder: 'transformation',
  ordinal_encoder: 'transformation',
  label_encoder: 'transformation',
  frequency_encoder: 'transformation',
  target_encoder: 'transformation',
  hashing_encoder: 'transformation',
  extract_datetime_features: 'transformation',
  drop_original_datetime: 'transformation',
};

function getNodeSize(node) {
  if (node.kind === 'input') return { width: INPUT_WIDTH, height: 84 };
  if (node.kind === 'output') return { width: OUTPUT_WIDTH, height: 84 };
  if (node.kind === 'operation') return { width: OP_CARD_WIDTH, height: OP_CARD_HEIGHT };
  if (node.kind === 'bus') return { width: BUS_WIDTH, height: node.height || JUNCTION_SIZE };
  if (node.kind === 'junction') {
    return {
      width: node.virtualWidth || JUNCTION_SIZE,
      height: node.virtualHeight || JUNCTION_SIZE,
    };
  }
  return { width: CARD_WIDTH, height: CARD_HEIGHT };
}

function distributedPortOffset(node, size, index, count, offsetY = 0) {
  if (index === undefined || index === null || !count || count <= 1) {
    return offsetY;
  }

  const verticalPadding = node.kind === 'junction' ? 10 : 26;
  const usableSpread = Math.max(0, size.height - verticalPadding);
  const step = usableSpread / Math.max(count - 1, 1);

  return -usableSpread / 2 + index * step + offsetY;
}

function getAnchor(node, side = 'right', options = {}) {
  const size = getNodeSize(node);
  const portOffset = distributedPortOffset(
    node,
    size,
    options.portIndex,
    options.portCount,
    options.offsetY || 0,
  );
  const centerY = node.y + size.height / 2 + portOffset;
  const centerX = node.x + size.width / 2;

  if (side === 'left') return { x: node.x, y: centerY };
  if (side === 'right') return { x: node.x + size.width, y: centerY };
  if (side === 'top') return { x: centerX, y: node.y };
  if (side === 'bottom') return { x: centerX, y: node.y + size.height };
  if (side === 'center') return { x: centerX, y: centerY };

  return { x: centerX, y: centerY };
}

function buildCurvedRoutedPath(from, to, edge) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const direction = dx >= 0 ? 1 : -1;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const laneOffset = edge.laneOffset || 0;
  const curveOffset = edge.curveOffset || 0;

  if (absDy < 28) {
    const control = Math.max(58, Math.min(180, absDx * 0.44));
    return `M ${from.x} ${from.y} C ${from.x + control * direction} ${from.y + curveOffset + laneOffset}, ${to.x - control * direction} ${to.y + curveOffset - laneOffset}, ${to.x} ${to.y}`;
  }

  const minRailGap = 74;
  const rawRailX = from.x + dx * 0.5 + (edge.routerOffsetX || 0);
  const lowerRailBound = Math.min(from.x, to.x) + minRailGap;
  const upperRailBound = Math.max(from.x, to.x) - minRailGap;
  const railX = lowerRailBound < upperRailBound
    ? Math.min(Math.max(rawRailX, lowerRailBound), upperRailBound)
    : from.x + direction * Math.max(52, absDx * 0.36);

  const radius = Math.min(46, Math.max(24, absDx * 0.16), Math.max(24, absDy * 0.28));
  const fromHorizontalX = railX - radius * direction;
  const toHorizontalX = railX + radius * direction;
  const verticalStartY = from.y + curveOffset + laneOffset;
  const verticalEndY = to.y + curveOffset - laneOffset;
  const verticalDirection = verticalEndY >= verticalStartY ? 1 : -1;

  return [
    `M ${from.x} ${from.y}`,
    `C ${from.x + radius * direction} ${from.y}, ${fromHorizontalX} ${verticalStartY}, ${railX} ${verticalStartY}`,
    `L ${railX} ${verticalEndY - radius * verticalDirection}`,
    `C ${railX} ${verticalEndY}, ${toHorizontalX} ${to.y}, ${to.x} ${to.y}`,
  ].join(' ');
}

function GraphEdge({ edge, fromNode, toNode, isHighlighted }) {
  const from = getAnchor(fromNode, edge.fromSide || 'right', {
    offsetY: edge.fromOffsetY || 0,
    portIndex: edge.fromPortIndex,
    portCount: edge.fromPortCount,
  });
  const to = getAnchor(toNode, edge.toSide || 'left', {
    offsetY: edge.toOffsetY || 0,
    portIndex: edge.toPortIndex,
    portCount: edge.toPortCount,
  });
  const path = buildCurvedRoutedPath(from, to, edge);
  const opacity = isHighlighted ? 0.74 : 0.12;
  const width = isHighlighted ? 2.1 : 1.0;

  return (
    <g pointerEvents="none">
      <path d={path} fill="none" stroke={edge.color} strokeWidth="9" strokeOpacity={isHighlighted ? 0.038 : 0.014} strokeLinecap="round" strokeLinejoin="round" />
      <path d={path} fill="none" stroke={edge.color} strokeWidth={width} strokeOpacity={opacity} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function StageLabel({ x, label, helper }) {
  return (
    <div className="absolute top-6" style={{ left: x }}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[11px] font-medium text-muted-foreground/70">{helper}</p>
    </div>
  );
}

function InputNode({ node, datasetName, selected, onDragStart }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute overflow-hidden rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur-xl"
      style={{ left: node.x, top: node.y, width: INPUT_WIDTH, zIndex: selected ? 8 : 4, boxShadow: selected ? '0 18px 44px rgba(67,97,238,0.16)' : '0 14px 34px rgba(15,23,42,0.08)' }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Move input node"
          onMouseDown={(event) => onDragStart(event, node.id)}
          className="flex h-8 w-8 flex-none cursor-grab items-center justify-center rounded-2xl border border-white/70 bg-white/60 text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
        >
          <Grip className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Input dataset</p>
          <p title={datasetName || 'Dataset'} className="truncate text-sm font-heading font-extrabold text-foreground">{datasetName || 'Dataset'}</p>
        </div>
      </div>
    </motion.div>
  );
}

function OutputNode({ node, columnCount, selected, onDragStart }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50/90 p-4 shadow-sm backdrop-blur-xl"
      style={{ left: node.x, top: node.y, width: OUTPUT_WIDTH, zIndex: selected ? 8 : 4, boxShadow: selected ? '0 18px 44px rgba(16,185,129,0.16)' : '0 14px 34px rgba(15,23,42,0.08)' }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Move output node"
          onMouseDown={(event) => onDragStart(event, node.id)}
          className="flex h-8 w-8 flex-none cursor-grab items-center justify-center rounded-2xl border border-emerald-200 bg-white/70 text-emerald-600/55 transition-colors hover:text-emerald-600 active:cursor-grabbing"
        >
          <Grip className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700/60">Output</p>
          <p className="text-sm font-heading font-extrabold text-foreground">{columnCount} active columns</p>
        </div>
      </div>
    </motion.div>
  );
}

function ColumnNode({ node, item, columnProfile, selected, onSelect, onDragStart }) {
  const effectiveType = getEffectiveTypeFromColumnPlan(item);
  const originalType = item.inferred_type || columnProfile?.inferred_type || 'text';
  const type = effectiveType || originalType;
  const meta = TYPE_META[type] || TYPE_META.text;
  const originalMeta = TYPE_META[originalType] || TYPE_META.text;
  const Icon = meta.icon;
  const dropped = item.steps.some((step) => step.operation === 'drop_column');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute rounded-3xl border p-4 text-left transition-shadow"
      style={{
        left: node.x,
        top: node.y,
        width: CARD_WIDTH,
        background: selected ? `${meta.color}12` : 'rgba(255,255,255,0.84)',
        borderColor: selected ? `${meta.color}55` : 'rgba(255,255,255,0.78)',
        boxShadow: selected ? `0 18px 44px ${meta.color}18` : '0 14px 34px rgba(15,23,42,0.08)',
        zIndex: selected ? 8 : 5,
      }}
      onClick={() => onSelect(item.column_name)}
    >
      <div className="mb-3 flex items-start gap-3">
        <button
          type="button"
          aria-label={`Move ${item.column_name}`}
          onMouseDown={(event) => onDragStart(event, node.id)}
          className="mt-1 flex h-8 w-8 flex-shrink-0 cursor-grab items-center justify-center rounded-2xl border border-white/70 bg-white/60 text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
        >
          <Grip className="h-4 w-4" />
        </button>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: `${meta.color}16`, color: meta.color }}>
          <Icon className="h-4 w-4" />
        </div>
        <button type="button" onClick={() => onSelect(item.column_name)} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-heading font-extrabold text-foreground">{item.column_name}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: `${meta.color}bb` }}>{meta.label}</p>
          {type !== originalType ? (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">Cast from <span style={{ color: originalMeta.color }}>{originalMeta.label}</span></p>
          ) : null}
        </button>
        {dropped ? <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-500">Drop</span> : null}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-muted-foreground">
        <div className="rounded-xl border border-white/70 bg-white/55 px-2 py-1.5">Missing {Math.round((columnProfile?.common_stats?.missing_ratio || 0) * 100)}%</div>
        <div className="rounded-xl border border-white/70 bg-white/55 px-2 py-1.5">Unique {columnProfile?.common_stats?.unique_count ?? '—'}</div>
      </div>
    </motion.div>
  );
}

function OperationNode({ node, step, columnName, selected, onSelect, onDragStart }) {
  const stepMeta = STEP_META[step.operation] || STEP_META.drop_column;
  const Icon = stepMeta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute rounded-3xl border p-3.5 text-left transition-shadow"
      style={{
        left: node.x,
        top: node.y,
        width: OP_CARD_WIDTH,
        background: selected ? `${stepMeta.color}12` : 'rgba(255,255,255,0.80)',
        borderColor: selected ? `${stepMeta.color}55` : 'rgba(255,255,255,0.76)',
        boxShadow: selected ? `0 18px 44px ${stepMeta.color}18` : '0 14px 34px rgba(15,23,42,0.07)',
        zIndex: selected ? 7 : 4,
      }}
      onClick={() => onSelect(columnName)}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={`Move ${stepMeta.label}`}
          onMouseDown={(event) => onDragStart(event, node.id)}
          className="mt-0.5 flex h-7 w-7 flex-shrink-0 cursor-grab items-center justify-center rounded-2xl border border-white/70 bg-white/60 text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
        >
          <Grip className="h-3.5 w-3.5" />
        </button>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: `${stepMeta.color}16`, color: stepMeta.color }}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-heading font-extrabold text-foreground">{stepMeta.label}</p>
          <p className="mt-0.5 truncate text-[10px] font-semibold text-muted-foreground">{columnName}</p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: `${stepMeta.color}bb` }}>{step.status || 'recommended'}</p>
        </div>
      </div>
    </motion.div>
  );
}

function JunctionNode({ node, selected }) {
  if (node.hidden) return null;

  const size = getNodeSize(node);
  const isRouter = size.height > JUNCTION_SIZE * 1.8;

  return (
    <div
      className={isRouter ? 'absolute rounded-full border bg-white/70 shadow-sm backdrop-blur-sm' : 'absolute rounded-full border-2 bg-white shadow-sm'}
      style={{
        left: node.x,
        top: node.y,
        width: size.width,
        height: size.height,
        borderColor: selected ? node.color || '#4361EE' : 'rgba(148,163,184,0.45)',
        background: isRouter ? `${node.color || '#4361EE'}10` : 'white',
        zIndex: 2,
      }}
      aria-hidden="true"
    />
  );
}

function BusNode({ node, selected }) {
  const size = getNodeSize(node);

  return (
    <div
      className="absolute rounded-full border bg-white/50 shadow-sm backdrop-blur-sm"
      style={{
        left: node.x,
        top: node.y,
        width: size.width,
        height: size.height,
        borderColor: selected ? `${node.color || '#4361EE'}66` : 'rgba(148,163,184,0.32)',
        background: `${node.color || '#4361EE'}0f`,
        zIndex: 1,
      }}
      aria-hidden="true"
    />
  );
}

function groupStepsByStage(steps) {
  return steps.reduce(
    (groups, step, stepIndex) => {
      const stage = STEP_STAGE[step.operation] || 'transformation';
      groups[stage].push({ step, stepIndex });
      return groups;
    },
    { preparation: [], transformation: [] },
  );
}

function stackTop(centerY, count) {
  const stackHeight = count * OP_CARD_HEIGHT + Math.max(0, count - 1) * OP_STACK_GAP;
  return centerY - stackHeight / 2;
}

function computeRows(plan) {
  let nextY = TOP_OFFSET;

  return plan.map((item, rowIndex) => {
    const groups = groupStepsByStage(item.steps);
    const maxStack = Math.max(1, groups.preparation.length, groups.transformation.length);
    const rowHeight = Math.max(
      MIN_ROW_HEIGHT,
      CARD_HEIGHT + 34,
      maxStack * OP_CARD_HEIGHT + Math.max(0, maxStack - 1) * OP_STACK_GAP + 34,
    );
    const row = {
      item,
      groups,
      rowIndex,
      top: nextY,
      height: rowHeight,
      centerY: nextY + rowHeight / 2,
    };
    nextY += rowHeight + ROW_GAP;
    return row;
  });
}

function edgeOffset(index, count, spacing = 18) {
  return (index - (count - 1) / 2) * spacing;
}

function addParallelEdges({ edges, from, targets, color, columnName, stageName }) {
  targets.forEach((targetId, index) => {
    const offset = edgeOffset(index, targets.length, 14);
    edges.push({
      id: `edge::${from}::${targetId}`,
      from,
      to: targetId,
      color,
      columnName,
      fromPortIndex: index,
      fromPortCount: targets.length,
      toPortIndex: 0,
      toPortCount: 1,
      fromOffsetY: 0,
      toOffsetY: 0,
      curveOffset: stageName === 'preparation' ? offset * 0.22 : offset * -0.20,
      laneOffset: offset * 0.10,
      routerOffsetX: offset * 1.2,
    });
  });
}

function buildStageLayout(plan) {
  const rows = computeRows(plan);
  const nodes = [];
  const edges = [];
  const graphTop = rows.length ? rows[0].top : TOP_OFFSET;
  const graphBottom = rows.length ? rows[rows.length - 1].top + rows[rows.length - 1].height : TOP_OFFSET + MIN_ROW_HEIGHT;
  const graphCenterY = (graphTop + graphBottom) / 2;
  const rowCount = Math.max(rows.length, 1);
  const inputBusX = STAGE_X.column - 52;
  const outputBusX = STAGE_X.output - 70;
  const busTop = graphTop - 28;
  const busHeight = Math.max(120, graphBottom - graphTop + 56);

  nodes.push({ id: 'input', kind: 'input', x: STAGE_X.input, y: graphCenterY - 42 });
  nodes.push({ id: 'output', kind: 'output', x: STAGE_X.output, y: graphCenterY - 42 });

  if (rows.length) {
    nodes.push({
      id: 'input-bus',
      kind: 'bus',
      x: inputBusX - BUS_WIDTH / 2,
      y: busTop,
      height: busHeight,
      color: '#4361EE',
    });
    nodes.push({
      id: 'output-bus',
      kind: 'bus',
      x: outputBusX - BUS_WIDTH / 2,
      y: busTop,
      height: busHeight,
      color: '#10B981',
    });
    nodes.push({
      id: 'input-hub',
      kind: 'junction',
      hidden: true,
      x: inputBusX - JUNCTION_SIZE / 2,
      y: graphCenterY - JUNCTION_SIZE / 2,
      color: '#4361EE',
    });
    nodes.push({
      id: 'output-hub',
      kind: 'junction',
      hidden: true,
      x: outputBusX - JUNCTION_SIZE / 2,
      y: graphCenterY - JUNCTION_SIZE / 2,
      color: '#10B981',
    });

    edges.push({
      id: 'edge::input::input-hub',
      from: 'input',
      to: 'input-hub',
      color: '#4361EE',
      columnName: null,
      fromSide: 'right',
      toSide: 'center',
      curveOffset: 0,
      laneOffset: 0,
    });

    edges.push({
      id: 'edge::output-hub::output',
      from: 'output-hub',
      to: 'output',
      color: '#10B981',
      columnName: null,
      fromSide: 'center',
      toSide: 'left',
      curveOffset: 0,
      laneOffset: 0,
    });
  }

  rows.forEach((row) => {
    const { item, groups, centerY, rowIndex } = row;
    const columnId = `column::${item.column_name}`;
    const typeColor = (TYPE_META[item.inferred_type] || TYPE_META.text).color;
    const columnY = centerY - CARD_HEIGHT / 2;

    nodes.push({ id: columnId, kind: 'column', columnName: item.column_name, item, x: STAGE_X.column, y: columnY });

    const inputPortId = `input-port::${item.column_name}`;
    nodes.push({
      id: inputPortId,
      kind: 'junction',
      hidden: true,
      columnName: item.column_name,
      x: inputBusX - JUNCTION_SIZE / 2,
      y: centerY - JUNCTION_SIZE / 2,
      color: typeColor,
    });

    edges.push({
      id: `edge::${inputPortId}::${columnId}`,
      from: inputPortId,
      to: columnId,
      color: typeColor,
      columnName: item.column_name,
      fromSide: 'right',
      toSide: 'left',
      curveOffset: edgeOffset(rowIndex, rowCount, 1.5),
      laneOffset: 0,
    });

    let previousSources = [columnId];

    const createStageNodes = (stageName, stageSteps) => {
      if (!stageSteps.length) return [];

      const stageTop = stackTop(centerY, stageSteps.length);
      return stageSteps.map(({ step, stepIndex }, index) => {
        const stepId = `step::${item.column_name}::${step.id || stepIndex}`;
        nodes.push({
          id: stepId,
          kind: 'operation',
          columnName: item.column_name,
          step,
          x: STAGE_X[stageName],
          y: stageTop + index * (OP_CARD_HEIGHT + OP_STACK_GAP),
        });
        return stepId;
      });
    };

    const connectStage = (stageName, stageSteps, incomingSources) => {
      const stageNodeIds = createStageNodes(stageName, stageSteps);
      if (!stageNodeIds.length) return incomingSources;

      incomingSources.forEach((sourceId) => {
        addParallelEdges({
          edges,
          from: sourceId,
          targets: stageNodeIds,
          color: typeColor,
          columnName: item.column_name,
          stageName,
        });
      });

      if (stageNodeIds.length === 1) {
        return stageNodeIds;
      }

      const joinHeight = Math.max(
        JUNCTION_SIZE,
        stageNodeIds.length * 24 + Math.max(0, stageNodeIds.length - 1) * 8,
      );
      const joinId = `junction::${stageName}::${item.column_name}`;
      nodes.push({
        id: joinId,
        kind: 'junction',
        columnName: item.column_name,
        x: STAGE_X[stageName] + OP_CARD_WIDTH + 36,
        y: centerY - joinHeight / 2,
        virtualHeight: joinHeight,
        virtualWidth: JUNCTION_SIZE,
        color: typeColor,
      });

      stageNodeIds.forEach((stageNodeId, index) => {
        const offset = edgeOffset(index, stageNodeIds.length, 8);
        edges.push({
          id: `edge::${stageNodeId}::${joinId}`,
          from: stageNodeId,
          to: joinId,
          color: typeColor,
          columnName: item.column_name,
          fromPortIndex: 0,
          fromPortCount: 1,
          toPortIndex: index,
          toPortCount: stageNodeIds.length,
          fromOffsetY: 0,
          toOffsetY: 0,
          curveOffset: offset * -0.18,
          laneOffset: offset * 0.08,
          routerOffsetX: offset * 0.9,
        });
      });

      return [joinId];
    };

    previousSources = connectStage('preparation', groups.preparation, previousSources);
    previousSources = connectStage('transformation', groups.transformation, previousSources);

    const outputPortId = `output-port::${item.column_name}`;
    nodes.push({
      id: outputPortId,
      kind: 'junction',
      hidden: true,
      columnName: item.column_name,
      x: outputBusX - JUNCTION_SIZE / 2,
      y: centerY - JUNCTION_SIZE / 2,
      color: typeColor,
    });

    previousSources.forEach((sourceId, index) => {
      const sourceOffset = edgeOffset(index, previousSources.length, 8);
      edges.push({
        id: `edge::${sourceId}::${outputPortId}`,
        from: sourceId,
        to: outputPortId,
        color: typeColor,
        columnName: item.column_name,
        fromSide: 'right',
        toSide: 'left',
        fromPortIndex: index,
        fromPortCount: previousSources.length,
        curveOffset: sourceOffset * -0.14,
        laneOffset: sourceOffset * 0.06,
        routerOffsetX: sourceOffset * 1.0,
      });
    });
  });

  return { nodes, edges };
}

function ZoomControls({ zoom, setZoom, resetLayout }) {
  const zoomOut = () => setZoom((current) => Math.max(0.5, Number((current - 0.1).toFixed(2))));
  const zoomIn = () => setZoom((current) => Math.min(1.6, Number((current + 0.1).toFixed(2))));
  const resetZoom = () => setZoom(0.9);

  return (
    <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-2xl border border-white/70 bg-white/80 p-1 shadow-sm backdrop-blur-xl">
        <button type="button" onClick={zoomOut} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground"><ZoomOut className="h-4 w-4" /></button>
        <button type="button" onClick={resetZoom} className="rounded-xl px-2 py-2 text-[11px] font-black text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground">{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={zoomIn} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground"><ZoomIn className="h-4 w-4" /></button>
      </div>
      <button
        type="button"
        onClick={resetLayout}
        className="inline-flex items-center gap-2 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-xs font-bold text-muted-foreground shadow-sm backdrop-blur-xl transition-colors hover:text-foreground"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Reset layout
      </button>
    </div>
  );
}

export default function PipelineGraph({ datasetName, columns, plan, selectedColumn, onSelectColumn }) {
  const dragRef = useRef(null);
  const [positions, setPositions] = useState({});
  const [zoom, setZoom] = useState(0.9);

  const defaultGraph = useMemo(() => buildStageLayout(plan), [plan]);
  const createDefaultPositions = useCallback(() => {
    return Object.fromEntries(
      defaultGraph.nodes.map((node) => [node.id, { x: node.x, y: node.y }]),
    );
  }, [defaultGraph.nodes]);

  useEffect(() => {
    setPositions((current) => {
      const next = {};
      for (const node of defaultGraph.nodes) {
        const existing = current[node.id];
        const hasValidPosition = existing
          && Number.isFinite(existing.x)
          && Number.isFinite(existing.y);
        next[node.id] = hasValidPosition ? existing : { x: node.x, y: node.y };
      }
      return next;
    });
  }, [defaultGraph.nodes]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!dragRef.current) return;
      const { nodeId, startX, startY, originX, originY } = dragRef.current;
      const nextX = Math.max(18, originX + (event.clientX - startX) / zoom);
      const nextY = Math.max(90, originY + (event.clientY - startY) / zoom);
      setPositions((current) => ({ ...current, [nodeId]: { x: nextX, y: nextY } }));
    };

    const handleMouseUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [zoom]);

  const nodes = useMemo(() => defaultGraph.nodes.map((node) => ({ ...node, ...(positions[node.id] || { x: node.x, y: node.y }) })), [defaultGraph.nodes, positions]);
  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes]);
  const columnMap = useMemo(() => Object.fromEntries(columns.map((column) => [column.column_name, column])), [columns]);
  const activeColumnCount = useMemo(() => plan.filter((item) => !item.steps.some((step) => step.operation === 'drop_column')).length, [plan]);

  const handleDragStart = (event, nodeId) => {
    event.preventDefault();
    event.stopPropagation();
    const node = nodeMap[nodeId];
    if (node?.columnName) onSelectColumn(node.columnName);
    dragRef.current = {
      nodeId,
      startX: event.clientX,
      startY: event.clientY,
      originX: node?.x || 0,
      originY: node?.y || 0,
    };
  };

  const resetLayout = () => {
    dragRef.current = null;
    setPositions(createDefaultPositions());
  };

  const width = Math.max(1740, ...nodes.map((node) => node.x + getNodeSize(node).width + 160), 1740);
  const height = Math.max(660, ...nodes.map((node) => node.y + getNodeSize(node).height + 100), 660);

  return (
    <div className="relative h-full min-h-[640px] overflow-auto rounded-[28px] border border-white/70 bg-white/55 shadow-sm backdrop-blur-xl">
      <div className="absolute inset-0 opacity-80" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(67,97,238,0.13) 1px, transparent 0)', backgroundSize: `${26 * zoom}px ${26 * zoom}px` }} />
      <ZoomControls zoom={zoom} setZoom={setZoom} resetLayout={resetLayout} />

      <div className="relative" style={{ width: width * zoom, height: height * zoom }}>
        <div style={{ width, height, transform: `scale(${zoom})`, transformOrigin: '0 0', position: 'relative' }}>
          <StageLabel x={STAGE_X.input} label="Input" helper="Dataset source" />
          <StageLabel x={STAGE_X.column} label="Columns" helper="Feature branches" />
          <StageLabel x={STAGE_X.preparation} label="Preparation" helper="Cast, impute or drop" />
          <StageLabel x={STAGE_X.transformation} label="Transform" helper="Encode, scale, engineer" />
          <StageLabel x={STAGE_X.output} label="Output" helper="Processed features" />

          <svg className="absolute left-0 top-0 pointer-events-none" width={width} height={height} style={{ zIndex: 3 }}>
            {defaultGraph.edges.map((edge) => {
              const fromNode = nodeMap[edge.from];
              const toNode = nodeMap[edge.to];
              if (!fromNode || !toNode) return null;
              const isHighlighted = !selectedColumn || edge.columnName === selectedColumn || edge.columnName === null;
              return <GraphEdge key={edge.id} edge={edge} fromNode={fromNode} toNode={toNode} isHighlighted={isHighlighted} />;
            })}
          </svg>

          {nodes.map((node) => {
            if (node.kind === 'input') {
              return <InputNode key={node.id} node={node} datasetName={datasetName} selected={false} onDragStart={handleDragStart} />;
            }
            if (node.kind === 'output') {
              return <OutputNode key={node.id} node={node} columnCount={activeColumnCount} selected={false} onDragStart={handleDragStart} />;
            }
            if (node.kind === 'bus') {
              return <BusNode key={node.id} node={node} selected />;
            }
            if (node.kind === 'junction') {
              return <JunctionNode key={node.id} node={node} selected={!selectedColumn || node.columnName === selectedColumn} />;
            }
            if (node.kind === 'column') {
              return (
                <ColumnNode
                  key={node.id}
                  node={node}
                  item={node.item}
                  columnProfile={columnMap[node.item.column_name]}
                  selected={selectedColumn === node.item.column_name}
                  onSelect={onSelectColumn}
                  onDragStart={handleDragStart}
                />
              );
            }
            if (node.kind === 'operation') {
              return (
                <OperationNode
                  key={node.id}
                  node={node}
                  step={node.step}
                  columnName={node.columnName}
                  selected={selectedColumn === node.columnName}
                  onSelect={onSelectColumn}
                  onDragStart={handleDragStart}
                />
              );
            }
            return null;
          })}

          {!plan.length ? (
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                <GitBranch className="h-6 w-6" />
              </div>
              <p className="text-sm font-heading font-bold text-foreground">No columns found for this dataset metadata.</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">Open the dataset first so Ockham can hydrate column names, or connect the backend profiler endpoint.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
