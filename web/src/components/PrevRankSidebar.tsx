import React, { useEffect, useState } from 'react';
import { Drawer, Box, Typography, IconButton, Chip, Stack, ToggleButtonGroup, ToggleButton, Tooltip } from '@mui/material';
import { X } from 'lucide-react';

export type PrevRankItem = { rank: number; horseId: string; horseNo: number; name: string; avg: number; raceId: string; margin?: string };

interface PrevRankSidebarProps {
  open: boolean;
  onClose: () => void;
  // 前走ランキング用リスト
  itemsPrev: PrevRankItem[];
  // 前前走ランキング用リスト
  itemsPrev2: PrevRankItem[];
  // 初期表示モード（未指定時は'prev'）
  mode?: 'prev' | 'prev2';
  // 親からモード変更を受け取る（任意）
  onModeChange?: (mode: 'prev' | 'prev2') => void;
  // Drawerの種類（スマホ=temporary, PC=peristent）
  variant?: 'temporary' | 'persistent';
}

export default function PrevRankSidebar({ open, onClose, itemsPrev, itemsPrev2, mode = 'prev', onModeChange, variant = 'temporary' }: PrevRankSidebarProps) {
  const [localMode, setLocalMode] = useState<'prev' | 'prev2'>(mode);

  useEffect(() => {
    setLocalMode(mode);
  }, [mode]);

  const items = localMode === 'prev' ? itemsPrev : itemsPrev2;
  const title = localMode === 'prev' ? '前走レベルランキング' : '前前走レベルランキング';
  const caption = localMode === 'prev' ? '指標: 前走レースの平均賞金（万円/頭）で降順' : '指標: 前前走レースの平均賞金（万円/頭）で降順';

  const handleChange = (_: any, value: 'prev' | 'prev2' | null) => {
    if (!value) return;
    setLocalMode(value);
    onModeChange?.(value);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant={variant}
      sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', sm: 380 }, maxWidth: '90vw', zIndex: 1300 } }}
    >
      <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{title}</Typography>
          <IconButton onClick={onClose} size="small"><X size={20} /></IconButton>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {caption}
          </Typography>
          <Tooltip title="前走/前前走を切り替え">
            <ToggleButtonGroup
              size="small"
              color="primary"
              exclusive
              value={localMode}
              onChange={handleChange}
            >
              <ToggleButton value="prev">前走</ToggleButton>
              <ToggleButton value="prev2">前前走</ToggleButton>
            </ToggleButtonGroup>
          </Tooltip>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">計算中またはデータなし</Typography>
          ) : (
            <Stack spacing={0.5}>
              {items.map(item => (
                <Box key={item.horseId} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.95rem' }}>
                  <Box sx={{ minWidth: 28, height: 22, display: 'inline-grid', placeItems: 'center', borderRadius: 0.5, bgcolor: item.rank === 1 ? '#fde68a' : item.rank === 2 ? '#e5e7eb' : item.rank === 3 ? '#fcd34d' : '#f3f4f6', border: '1px solid #e5e7eb', fontWeight: 800 }}>{item.rank}</Box>
                  <Chip label={item.horseNo} size="small" sx={{ fontWeight: 700 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</Typography>
                  <Typography variant="caption" color="text.secondary">平 {item.avg}万{item.margin ? ` / 着差 ${item.margin}` : ''}</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
