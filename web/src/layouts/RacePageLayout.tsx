import React from 'react';
import { Box, Paper } from '@mui/material';
import PrevRankPanel from '../components/PrevRankPanel';
import RaceLevelRankPanel from '../components/RaceLevelRankPanel';

export default function RacePageLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{
      py: 4,
      // 3カラム: 左サイド / 中央（出馬表）/ 右サイド（ランキング）
      display: { xs: 'block', lg: 'grid' },
      // 基本は1カラム（中央のみ）。超ワイド(>=1900px)のみ左右サイドを表示。
      gridTemplateColumns: {
        lg: 'minmax(0, 1fr)',
      },
      '@media (min-width:1900px)': {
        gridTemplateColumns: 'minmax(320px, 1fr) minmax(0, 1360px) minmax(320px, 1fr)'
      },
      columnGap: { lg: 2 },
      alignItems: 'start',
      overflowX: 'hidden'
    }}>
      {/* 左カラム（レースレベルランキング：UIのみ） */}
      <Box sx={{ display: { xs: 'none', lg: 'none' }, '@media (min-width:1900px)': { display: 'block' }, gridColumn: { lg: 1 }, pl: 2, position: 'sticky', top: 24, alignSelf: 'start' }}>
        <Paper elevation={1} sx={{ p: 2, maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }}>
          <RaceLevelRankPanel />
        </Paper>
      </Box>
      {/* 中央カラム（出馬表） */}
      <Box sx={{ gridColumn: { lg: 1 }, px: { xs: 2, lg: 0 }, '@media (min-width:1900px)': { gridColumn: 2 } }}>
        {children}
      </Box>

      {/* 右カラム（前走ランキング） */}
      <Box sx={{
        display: { xs: 'none', lg: 'none' },
        '@media (min-width:1900px)': { display: 'block' },
        gridColumn: { lg: 3 }, pr: 2, position: 'sticky', top: 24, alignSelf: 'start' }}>
        <Paper elevation={1} sx={{ p: 2, maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }}>
          <PrevRankPanel />
        </Paper>
      </Box>
    </Box>
  );
}
