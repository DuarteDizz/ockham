import React from 'react';
import {
  ChartLine,
  ChartNetwork,
  Rocket,
  Shield,
  Sigma,
  Target,
  Trees,
} from 'lucide-react';
import { IconBinaryTree } from '@tabler/icons-react';

function PolynomialGlyph({ color, size, strokeWidth }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M1 11 Q4 2.5 7 6.8 Q10 10.8 13 4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function LogisticGlyph({ color, size, strokeWidth }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2 10.5C4.5 10.5 5.4 9.6 6.2 7.8C7 6 7.6 4.3 12 3.3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="7"
        y1="3"
        x2="7"
        y2="11"
        stroke={color}
        strokeWidth={Math.max(0.85, strokeWidth - 0.7)}
        strokeLinecap="round"
        opacity="0.32"
      />
    </svg>
  );
}

function SvrGlyph({ color, size, strokeWidth }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <line x1="1" y1="10" x2="13" y2="4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <line
        x1="1"
        y1="7.8"
        x2="13"
        y2="1.8"
        stroke={color}
        strokeWidth={Math.max(0.9, strokeWidth - 0.7)}
        strokeLinecap="round"
        strokeDasharray="2 1.8"
        opacity="0.55"
      />
      <line
        x1="1"
        y1="12.2"
        x2="13"
        y2="6.2"
        stroke={color}
        strokeWidth={Math.max(0.9, strokeWidth - 0.7)}
        strokeLinecap="round"
        strokeDasharray="2 1.8"
        opacity="0.55"
      />
    </svg>
  );
}

const LIBRARY_GLYPHS = {
  'linear-regression': ChartLine,
  'lasso-regression': Target,
  'ridge-regression': Shield,
  'random-forest-regression': Trees,
  'xgboost-regression': Rocket,
  'naive-bayes-classifier': Sigma,
  'knn-classifier': ChartNetwork,
};

export default function ModelGlyph({
  iconKey = 'linear-regression',
  color = '#ffffff',
  size = 16,
  strokeWidth = 1.7,
}) {
  if (iconKey === 'polynomial-regression') {
    return <PolynomialGlyph color={color} size={size} strokeWidth={strokeWidth} />;
  }

  if (iconKey === 'logistic-regression') {
    return <LogisticGlyph color={color} size={size} strokeWidth={strokeWidth} />;
  }

  if (iconKey === 'svr') {
    return <SvrGlyph color={color} size={size} strokeWidth={strokeWidth} />;
  }

  if (iconKey === 'decision-tree-regression') {
    return <IconBinaryTree color={color} size={size} stroke={strokeWidth} aria-hidden="true" />;
  }

  const Icon = LIBRARY_GLYPHS[iconKey] || ChartLine;
  return <Icon color={color} size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
}
