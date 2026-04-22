export function sortUiResultsByRankingMode(currentResults, mode) {
  return [...currentResults]
    .sort((a, b) => {
      const rankA = mode === 'score' ? a.performance_rank : a.ockham_rank;
      const rankB = mode === 'score' ? b.performance_rank : b.ockham_rank;
      return rankA - rankB;
    })
    .map((item) => ({
      ...item,
      display_rank: mode === 'score' ? item.performance_rank : item.ockham_rank,
      isRecommended: mode === 'score' ? item.performance_rank === 1 : !!item.raw?.is_ockham_recommended,
    }));
}
