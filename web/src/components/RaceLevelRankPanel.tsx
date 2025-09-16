import React, { useState } from 'react'
import { Box, Typography, Stack, Chip, ToggleButtonGroup, ToggleButton, Tooltip, Switch, FormControlLabel } from '@mui/material'
import { useRaceLevelStore } from '../store/raceLevelStore'

export default function RaceLevelRankPanel() {
  const items = useRaceLevelStore(s => s.items)
  const [displayMode, setDisplayMode] = useState<'detail' | 'names'>('detail')

  const title = 'レースレベルランキング'
  const caption = '指標: 前走同走馬の「最初の次走」平均着順（小数1桁）。DNF/DQ等は除外。'

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{title}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={displayMode === 'names'}
                onChange={(e) => setDisplayMode(e.target.checked ? 'names' : 'detail')}
              />
            }
            label="名前のみ"
          />
        </Box>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{caption}</Typography>

      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">計算中またはデータなし</Typography>
      ) : (
        <Stack spacing={0.5}>
          {items.map((item) => (
            <Box key={item.horseId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ minWidth: 28, height: 22, display: 'inline-grid', placeItems: 'center', borderRadius: 0.5, bgcolor: item.rank === 1 ? '#fde68a' : item.rank === 2 ? '#e5e7eb' : item.rank === 3 ? '#fcd34d' : '#f3f4f6', border: '1px solid #e5e7eb', fontWeight: 800 }}>{item.rank}</Box>
              <Chip label={item.horseNo} size="small" sx={{ fontWeight: 700 }} />
              {displayMode === 'detail' ? (
                <>
                  <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.avgPlace !== null ? `平均 ${item.avgPlace}位` : '平均 -'}
                    {`（${item.used}/${item.total}）`}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                  {item.name}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  )
}
