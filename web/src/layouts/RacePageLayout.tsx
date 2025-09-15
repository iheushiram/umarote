import React from 'react';
import { Box, Paper } from '@mui/material';
import PrevRankPanel from '../components/PrevRankPanel';

export default function RacePageLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{
      py: 4,
      // 3カラム: 左サイド / 中央（出馬表）/ 右サイド（ランキング）
      display: { xs: 'block', lg: 'grid' },
      // サイドは均等幅（最小320px、残りは等分）・中央は最大1200pxで維持
      gridTemplateColumns: { lg: 'minmax(320px, 1fr) minmax(auto, 1200px) minmax(320px, 1fr)' },
      columnGap: { lg: 2 },
      alignItems: 'start'
    }}>
      {/* 中央カラム（出馬表） */}
      <Box sx={{ gridColumn: { lg: 2 }, px: { xs: 2, lg: 0 } }}>
        {children}
      </Box>

      {/* 右カラム（ダミーの前走ランキング） */}
      <Box sx={{ display: { xs: 'none', lg: 'block' }, gridColumn: { lg: 3 }, pr: 2, position: 'sticky', top: 24, alignSelf: 'start' }}>
        <Paper elevation={1} sx={{ p: 2, maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }}>
          <PrevRankPanel />
        </Paper>
      </Box>
    </Box>
  );
}
