import React, { useState, useEffect } from 'react'
import { Box, Typography, Stack, Chip, ToggleButtonGroup, ToggleButton, Tooltip, Divider, Switch, FormControlLabel } from '@mui/material'
import { useRaceUiStore } from '../store/raceUiStore'

export default function PrevRankPanel() {
  const { itemsPrev, itemsPrev2, mode, setMode } = useRaceUiStore()
  const [localMode, setLocalMode] = useState<'prev' | 'prev2'>(mode)

  useEffect(() => setLocalMode(mode), [mode])

  const items = localMode === 'prev' ? itemsPrev : itemsPrev2
  const [displayMode, setDisplayMode] = useState<'detail' | 'names'>('detail')
  const title = localMode === 'prev' ? '前走レベルランキング' : '前前走レベルランキング'
  const caption = localMode === 'prev' ? '指標: 前走レースの平均賞金（万円/頭）で降順' : '指標: 前前走レースの平均賞金（万円/頭）で降順'

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{title}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="前走/前前走を切り替え">
            <ToggleButtonGroup
              size="small"
              color="primary"
              exclusive
              value={localMode}
              onChange={(_, v) => { if (v) { setLocalMode(v); setMode(v) } }}
            >
              <ToggleButton value="prev">前走</ToggleButton>
              <ToggleButton value="prev2">前前走</ToggleButton>
            </ToggleButtonGroup>
          </Tooltip>
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

      <Box sx={{}}
      >
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
                    <Typography variant="caption" color="text.secondary">平 {item.avg}万{item.margin ? ` / 着差 ${item.margin}` : ''}</Typography>
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
    </Box>
  )
}
