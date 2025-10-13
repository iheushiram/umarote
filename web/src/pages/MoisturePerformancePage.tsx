// web/src/pages/MoisturePerformancePage.tsx
// 含水率別の成績差を確認できるフロントエンドページです。
// 既存の含水率分析APIを可視化し、比較検討を素早く行うために用意します。
// RELEVANT FILES:web/src/services/horseService.ts,web/src/types/moisture.ts,src/routes/moistureAnalysis.ts,web/src/components/moisture/MoistureOutcomeSummary.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, Paper, Typography } from '@mui/material';
import {
  getMoistureOutcomes,
  type MoistureOutcomeParams,
} from '../services/horseService';
import type { MoistureOutcomeResponse } from '../types/moisture';
import MoistureOutcomeFilters, {
  DraftFilters,
} from '../components/moisture/MoistureOutcomeFilters';
import MoistureOutcomeSummary from '../components/moisture/MoistureOutcomeSummary';

const DEFAULT_FILTERS: MoistureOutcomeParams = {
  surface: 'all',
  metric: 'goal',
  focus: 'all',
  bucket: 1,
  limit: 1000,
};

const DEFAULT_DRAFT: DraftFilters = {
  surface: 'all',
  metric: 'goal',
  focus: 'all',
  venue: '',
  distance: '',
  from: '',
  to: '',
  bucket: String(DEFAULT_FILTERS.bucket),
  limit: String(DEFAULT_FILTERS.limit),
};

const MAX_SAMPLE_COUNT = 12;

const normalizeIsoDate = (value: string): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{8}$/.test(trimmed)) {
    const year = trimmed.slice(0, 4);
    const month = trimmed.slice(4, 6);
    const day = trimmed.slice(6, 8);
    return `${year}-${month}-${day}`;
  }
  return trimmed;
};

const MoisturePerformancePage: React.FC = () => {
  const [draft, setDraft] = useState<DraftFilters>(DEFAULT_DRAFT);
  const [filters, setFilters] = useState<MoistureOutcomeParams>(DEFAULT_FILTERS);
  const [data, setData] = useState<MoistureOutcomeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDraftChange = <Key extends keyof DraftFilters>(
    key: Key,
    value: DraftFilters[Key],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getMoistureOutcomes(filters);
        if (cancelled) return;
        if (!result) {
          setData(null);
          setError('含水率集計の取得に失敗しました。');
        } else {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError('含水率集計の取得に失敗しました。');
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

  const flattenedSamples = useMemo(() => {
    if (!data?.buckets) return [];
    return data.buckets.flatMap((bucket) =>
      bucket.samples.map((sample) => ({
        bucket,
        sample,
      })),
    );
  }, [data]);

  const samplesForDisplay = useMemo(
    () => flattenedSamples.slice(0, MAX_SAMPLE_COUNT),
    [flattenedSamples],
  );

  const handleApply = () => {
    const bucketValue = Number.parseFloat(draft.bucket);
    const limitValue = Number.parseInt(draft.limit, 10);
    const distanceValue = Number.parseInt(draft.distance, 10);

    const next: MoistureOutcomeParams = {
      surface: draft.surface,
      metric: draft.metric,
      focus: draft.focus,
      bucket:
        Number.isFinite(bucketValue) && bucketValue > 0
          ? bucketValue
          : DEFAULT_FILTERS.bucket,
      limit:
        Number.isFinite(limitValue) && limitValue > 0
          ? limitValue
          : DEFAULT_FILTERS.limit,
    };

    const trimmedVenue = draft.venue.trim();
    if (trimmedVenue) {
      next.venue = trimmedVenue;
    }

    if (Number.isFinite(distanceValue) && distanceValue > 0) {
      next.distance = distanceValue;
    }

    const from = normalizeIsoDate(draft.from);
    if (from) {
      next.from = from;
    }

    const to = normalizeIsoDate(draft.to);
    if (to) {
      next.to = to;
    }

    setFilters(next);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
          含水率別パフォーマンス
        </Typography>
        <Typography variant="body1" color="text.secondary">
          馬場含水率ごとの勝率や平均着順をざっと比較できます。
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <MoistureOutcomeFilters
          draft={draft}
          onDraftChange={handleDraftChange}
          onApply={handleApply}
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

      {!loading && error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && data && (
        <MoistureOutcomeSummary buckets={data.buckets} samples={samplesForDisplay} />
      )}
    </Box>
  );
};

export default MoisturePerformancePage;

