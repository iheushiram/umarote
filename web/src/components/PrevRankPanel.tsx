import React, { useState, useEffect } from 'react'
import { Box, Typography, Stack, Chip, ToggleButtonGroup, ToggleButton, Tooltip, Switch, FormControlLabel, ButtonBase } from '@mui/material'
import { useRaceUiStore } from '../store/raceUiStore'
import type { PrevRankItem } from '../store/raceUiStore'
import { useHorseFocusStore } from '../store/horseFocusStore'
import '../styles/focus-highlight.css'

function PrevRankRow({
  item,
  displayMode,
  onFocus,
  isFocused,
}: {
  item: PrevRankItem
  displayMode: 'detail' | 'names'
  onFocus: (horseId: string) => void
  isFocused: boolean
}) {
  return (
    <ButtonBase
      disableRipple
      onClick={() => onFocus(item.horseId)}
      className={isFocused ? 'rank-item-button rank-item-button--active' : 'rank-item-button'}
      sx={{
        width: '100%',
        borderRadius: 1,
        px: 1,
        py: 0.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        textAlign: 'left',
        justifyContent: 'flex-start',
        transition: 'background-color 120ms ease',
        '&:hover': { backgroundColor: 'action.hover' },
      }}
    >
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
    </ButtonBase>
  )
}

export default function PrevRankPanel() {
  const { itemsPrev, itemsPrev2, mode, setMode } = useRaceUiStore()
  const [localMode, setLocalMode] = useState<'prev' | 'prev2'>(mode)
  const focus = useHorseFocusStore(state => state.focus)
  const focusedHorseId = useHorseFocusStore(state => state.focusedHorseId)

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
              <PrevRankRow
                key={item.horseId}
                item={item}
                displayMode={displayMode}
                onFocus={focus}
                isFocused={focusedHorseId === item.horseId}
              />
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  )
}
