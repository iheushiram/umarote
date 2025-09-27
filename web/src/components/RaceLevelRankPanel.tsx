import React, { useState } from 'react'
import { Box, Typography, Stack, Chip, ToggleButtonGroup, ToggleButton, Tooltip, Switch, FormControlLabel, ButtonBase, Collapse, Divider } from '@mui/material'
import { useRaceLevelStore } from '../store/raceLevelStore'
import type { RaceLevelRankItem } from '../store/raceLevelStore'
import { useHorseFocusStore } from '../store/horseFocusStore'
import '../styles/focus-highlight.css'
import { ChevronDown, ChevronRight } from 'lucide-react'

type MetricMode = 'place' | 'margin'

function RaceLevelRankRow({
  item,
  displayMode,
  metricMode,
  onFocus,
  isFocused,
  onToggle,
  isExpanded,
}: {
  item: RaceLevelRankItem
  displayMode: 'detail' | 'names'
  metricMode: MetricMode
  onFocus: (horseId: string) => void
  isFocused: boolean
  onToggle?: (horseId: string) => void
  isExpanded?: boolean
}) {
  return (
    <Tooltip
      describeChild
      disableInteractive
      title={(
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {item.name}
        </Typography>
      )}
      placement="right"
      componentsProps={{ tooltip: { sx: { maxWidth: 360 } } }}
    >
      <ButtonBase
        disableRipple
        onClick={() => {
          onFocus(item.horseId)
          onToggle?.(item.horseId)
        }}
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
        {onToggle && (
          isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
        )}
        <Box sx={{ minWidth: 28, height: 22, display: 'inline-grid', placeItems: 'center', borderRadius: 0.5, bgcolor: item.rank === 1 ? '#fde68a' : item.rank === 2 ? '#e5e7eb' : item.rank === 3 ? '#fcd34d' : '#f3f4f6', border: '1px solid #e5e7eb', fontWeight: 800 }}>
          {item.rank}
        </Box>
        <Chip label={item.horseNo} size="small" sx={{ fontWeight: 700 }} />
        {displayMode === 'detail' ? (
          <>
            <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {metricMode === 'margin'
                ? item.avgMargin !== null
                  ? `平均着差 ${item.avgMargin.toFixed(2)}`
                  : '平均着差 -'
                : item.avgPlace !== null
                  ? `平均 ${item.avgPlace}位`
                  : '平均 -'
              }
              {metricMode === 'margin'
                ? `（${item.marginUsed}/${item.total}）`
                : `（${item.used}/${item.total}）`
              }
            </Typography>
          </>
        ) : (
          <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'normal', wordBreak: 'break-word' }}>
            {item.name}
          </Typography>
        )}
      </ButtonBase>
    </Tooltip>
  )
}

export default function RaceLevelRankPanel({
  onToggleCoRunners,
  expandedMap,
  renderCoRunnerContent,
}: {
  onToggleCoRunners?: (horseId: string) => void
  expandedMap?: Record<string, boolean>
  renderCoRunnerContent?: (horseId: string) => React.ReactNode
} = {}) {
  const items = useRaceLevelStore(s => s.items)
  const [displayMode, setDisplayMode] = useState<'detail' | 'names'>('detail')
  const [metricMode, setMetricMode] = useState<MetricMode>('place')
  const focus = useHorseFocusStore(state => state.focus)
  const focusedHorseId = useHorseFocusStore(state => state.focusedHorseId)

  const title = 'レースレベルランキング'
  const caption = '指標: 前走同走馬の「最初の次走」平均着順（小数1桁）。DNF/DQ等は除外。'

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{title}</Typography>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={displayMode === 'names'}
              onChange={(e) => setDisplayMode(e.target.checked ? 'names' : 'detail')}
            />
          }
          label="名前のみ"
          sx={{ mr: 0 }}
        />
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{caption}</Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 1, mt: 0.75 }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={metricMode === 'margin'}
              onChange={(e) => setMetricMode(e.target.checked ? 'margin' : 'place')}
            />
          }
          label="平均着差で表示"
          sx={{ mr: 0 }}
        />
      </Box>

      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">計算中またはデータなし</Typography>
      ) : (
        <Stack spacing={0.5}>
          {items.map((item) => (
            <Box key={item.horseId} sx={{ border: '1px solid #e5e7eb', borderRadius: 1, bgcolor: expandedMap?.[item.horseId] ? 'rgba(59,130,246,0.08)' : 'background.paper', transition: 'background-color 150ms ease' }}>
              <RaceLevelRankRow
                item={item}
                displayMode={displayMode}
                metricMode={metricMode}
                onFocus={focus}
                isFocused={focusedHorseId === item.horseId}
                onToggle={onToggleCoRunners}
                isExpanded={!!expandedMap?.[item.horseId]}
              />
              {onToggleCoRunners && (
                <Collapse in={!!expandedMap?.[item.horseId]} timeout="auto" unmountOnExit>
                  <Divider sx={{ mx: 1 }} />
                  <Box sx={{ px: 1.25, py: 1 }}>
                    {renderCoRunnerContent?.(item.horseId)}
                  </Box>
                </Collapse>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  )
}
