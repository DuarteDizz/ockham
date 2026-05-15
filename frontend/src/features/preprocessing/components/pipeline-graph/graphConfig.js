export const CARD_WIDTH = 232;
export const CARD_HEIGHT = 126;
export const OP_CARD_WIDTH = 214;
export const OP_CARD_HEIGHT = 102;
export const INPUT_WIDTH = 280;
export const OUTPUT_WIDTH = 250;
export const JUNCTION_SIZE = 12;
export const BUS_WIDTH = 10;
export const OP_STACK_GAP = 18;
export const MIN_ROW_HEIGHT = 176;
export const TOP_OFFSET = 132;
export const ROW_GAP = 34;

export const STAGE_X = {
  input: 44,
  column: 380,
  preparation: 704,
  transformation: 1032,
  output: 1412,
};

export const STEP_STAGE = {
  cast_numeric: 'preparation',
  cast_datetime: 'preparation',
  median_imputer: 'preparation',
  mean_imputer: 'preparation',
  most_frequent_imputer: 'preparation',
  constant_imputer: 'preparation',
  drop_rows_missing: 'preparation',
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
