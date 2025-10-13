// web/src/pages/MoistureRacePerformancePage.tsx
// 含水率とレース成績の関係を一覧表示するページです。
// Moisture分析APIからレース単位の情報を取得して簡潔に比較できるようにします。
// RELEVANT FILES:web/src/services/horseService.ts,web/src/types/moisture.ts,src/routes/moistureAnalysis.ts,web/src/App.tsx

import React, { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Paper, Typography } from '@mui/material';
import {
  getMoistureRacePerformance,
  type MoistureRacePerformanceParams,
} from '../services/horseService';
import type { MoistureRacePerformanceResponse } from '../types/moisture';
import MoistureRaceFilters, {
  DraftRaceFilters,
} from '../components/moisture/MoistureRaceFilters';
import MoistureRaceTable from '../components/moisture/MoistureRaceTable';

const DEFAULT_FILTERS: MoistureRacePerformanceParams = {
  surface: 'all',
  metric: 'goal',
  limit: 50,
  top: 3,
};

const DEFAULT_DRAFT: DraftRaceFilters = {
  surface: 'all',
  metric: 'goal',
  venue: '',
  distance: '',
  from: '',
  to: '',
  limit: String(DEFAULT_FILTERS.limit ?? 50),
  top: String(DEFAULT_FILTERS.top ?? 3),
};

const MoistureRacePerformancePage: React.FC = () => {
  const [draft, setDraft] = useState<DraftRaceFilters>(DEFAULT_DRAFT);
  const [filters, setFilters] = useState<MoistureRacePerformanceParams>(DEFAULT_FILTERS);
  const [data, setData] = useState<MoistureRacePerformanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォーム入力を一箇所で管理してバリデーション処理との整合を取りやすくします。
  const handleDraftChange = <Key extends keyof DraftRaceFilters>(
    key: Key,
    value: DraftRaceFilters[Key],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getMoistureRacePerformance(filters);
        if (!cancelled) {
          if (!result) {
            setError('含水率レース成績の取得に失敗しました。');
            setData(null);
          } else {
            setData(result);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError('含水率レース成績の取得に失敗しました。');
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const handleApply = () => {
    const trimmedVenue = draft.venue.trim();
    const parsedDistance = Number.parseInt(draft.distance, 10);
    const parsedLimit = Number.parseInt(draft.limit, 10);
    const parsedTop = Number.parseInt(draft.top, 10);

    setFilters({
      surface: draft.surface,
      metric: draft.metric,
      venue: trimmedVenue ? trimmedVenue : undefined,
      distance: Number.isFinite(parsedDistance) && parsedDistance > 0 ? parsedDistance : undefined,
      limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_FILTERS.limit,
      top: Number.isFinite(parsedTop) && parsedTop > 0 ? parsedTop : DEFAULT_FILTERS.top,
      from: draft.from || undefined,
      to: draft.to || undefined,
    });
  };

  const handleReset = () => {
    setDraft(DEFAULT_DRAFT);
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4" sx={{ mb: 1 }}>
          含水率別レース成績
        </Typography>
        <Typography variant="body2" color="text.secondary">
          含水率の違いによるレース結果を一目で比較できます。
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <MoistureRaceFilters
          draft={draft}
          onDraftChange={handleDraftChange}
          onApply={handleApply}
          onReset={handleReset}
        />
      </Paper>

      {loading && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress size={28} />
          <Typography variant="body2" sx={{ mt: 2 }}>
            集計中です…
          </Typography>
        </Paper>
      )}

      {!loading && error && (
        <Alert severity="error">{error}</Alert>
      )}

      {!loading && !error && data && <MoistureRaceTable data={data} />}
    </Box>
  );
};

export default MoistureRacePerformancePage;
