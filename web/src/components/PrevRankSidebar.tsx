import React from 'react';
import { Drawer, Box, Typography, IconButton, Chip, Stack } from '@mui/material';
import { X } from 'lucide-react';

export type PrevRankItem = { rank: number; horseId: string; horseNo: number; name: string; avg: number; raceId: string; margin?: string };

interface PrevRankSidebarProps {
  open: boolean;
  onClose: () => void;
  items: PrevRankItem[];
}

export default function PrevRankSidebar({ open, onClose, items }: PrevRankSidebarProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', sm: 380 }, maxWidth: '90vw' } }}
    >
      <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>前走レベルランキング</Typography>
          <IconButton onClick={onClose} size="small"><X size={20} /></IconButton>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
          指標: 前走レースの平均賞金（万円/頭）で降順
        </Typography>

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
