function inferTypeFromName(columnName) {
  const name = String(columnName || '').toLowerCase();
  if (/(^id$|_id$|uuid|hash|cpf|cnpj|email|telefone|phone|document|matricula|placa)/.test(name)) return 'identifier';
  if (/(data|date|dt_|timestamp|created|updated|inicio|fim)/.test(name)) return 'datetime_like_text';
  if (/(descricao|description|comentario|comment|observacao|obs|texto|message|mensagem)/.test(name)) return 'free_text';
  if (/(ativo|active|flag|is_|has_|true|false)/.test(name)) return 'boolean';
  if (/(valor|custo|price|income|score|idade|age|tempo|qtd|quant|count|total|taxa|rate|percent)/.test(name)) return 'numeric';
  return 'categorical';
}

export function buildColumnProfilesFromDataset(dataset, datasetColumns = []) {
  const names = Array.isArray(datasetColumns) && datasetColumns.length
    ? datasetColumns
    : Array.isArray(dataset?.column_names)
      ? dataset.column_names
      : Array.isArray(dataset?.columns_metadata)
        ? dataset.columns_metadata.map((col) => col.name || col.column_name).filter(Boolean)
        : [];

  return names.map((name, index) => {
    const inferredType = inferTypeFromName(name);
    const uniqueCount = inferredType === 'identifier' ? Math.max(dataset?.rows || 100, 100) : inferredType === 'categorical' ? 6 + (index % 8) : 0;
    const totalCount = dataset?.rows || 0;
    return {
      column_name: name,
      raw_dtype: inferredType.includes('numeric') ? 'float64' : 'object',
      inferred_type: inferredType,
      type_inference: {
        numeric_parse_ratio: inferredType === 'numeric_like_text' ? 1 : inferredType === 'numeric' ? 1 : 0,
        datetime_parse_ratio: inferredType === 'datetime_like_text' ? 1 : inferredType === 'datetime' ? 1 : 0,
      },
      common_stats: {
        total_count: totalCount,
        observed_count: totalCount,
        missing_count: index % 4 === 0 ? Math.max(Math.floor(totalCount * 0.03), 0) : 0,
        missing_ratio: index % 4 === 0 ? 0.03 : 0,
        unique_count: uniqueCount || Math.max(Math.floor(totalCount * 0.12), 1),
        unique_ratio: totalCount ? (uniqueCount || Math.floor(totalCount * 0.12)) / totalCount : 0,
        is_empty: false,
        is_constant: false,
        is_mostly_missing: false,
      },
      specific_stats: buildMockSpecificStats(inferredType, index),
    };
  });
}

function buildMockSpecificStats(type, index) {
  if (type === 'numeric' || type === 'numeric_like_text') {
    return {
      mean: 50 + index * 3,
      median: 48 + index * 2,
      std: 11 + index,
      p25: 34,
      p75: 66,
      skewness: index % 3 === 0 ? 1.4 : 0.35,
      kurtosis: index % 3 === 0 ? 4.8 : 1.1,
      outlier_ratio_iqr: index % 3 === 0 ? 0.08 : 0.01,
      zero_ratio: 0,
      normality_score: index % 3 === 0 ? 0.02 : 0.41,
    };
  }
  if (type === 'datetime' || type === 'datetime_like_text') {
    return {
      parse_success_ratio: 1,
      timespan_days: 730,
      has_time_component: false,
      month_distribution: { 1: 0.09, 2: 0.08, 3: 0.1, 4: 0.06, 5: 0.11 },
      weekday_distribution: { 0: 0.16, 1: 0.14, 2: 0.15, 3: 0.15, 4: 0.16, 5: 0.12, 6: 0.12 },
    };
  }
  if (type === 'identifier') {
    return {
      top_1_ratio: 0.001,
      normalized_entropy: 0.99,
      avg_length: 16,
      numeric_parse_ratio: 0,
      datetime_parse_ratio: 0,
      unique_pattern_count: 2,
      top_pattern_ratio: 0.9,
    };
  }
  if (type === 'free_text') {
    return {
      top_1_ratio: 0.002,
      top_5_ratio: 0.01,
      normalized_entropy: 0.96,
      avg_length: 128,
      max_length: 640,
      numeric_parse_ratio: 0,
      datetime_parse_ratio: 0,
      unique_pattern_count: 100,
      top_pattern_ratio: 0.02,
    };
  }
  return {
    top_1_ratio: 0.42,
    top_5_ratio: 0.88,
    rare_value_ratio: 0.05,
    entropy: 1.8,
    normalized_entropy: 0.72,
    avg_length: 9 + index,
    median_length: 8,
    max_length: 24,
    numeric_parse_ratio: 0,
    datetime_parse_ratio: 0,
    unique_pattern_count: 3,
    top_pattern_ratio: 0.76,
    masked_top_distribution: {
      VALUE_001: 0.42,
      VALUE_002: 0.24,
      VALUE_003: 0.15,
      VALUE_004: 0.07,
    },
  };
}
