import React from 'react'
import { Box, Typography, ButtonBase, Tooltip } from '@mui/material'
import '../styles/focus-highlight.css'

export type PrevRaceSpeedSummaryItem = {
  horseId: string
  horseNo: number
  name: string
  speed: number
  track: string
  distance: number
  surface: '芝' | 'ダート'
  date?: string
  raceName?: string
}

const formatDateShort = (value?: string): string => {
  if (!value) return ''
  // YYYYMMDD
  if (/^\d{8}$/.test(value)) {
    const y = value.slice(0, 4)
    const m = value.slice(4, 6)
    const d = value.slice(6, 8)
    return `${y}.${m}.${d}`
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-')
    return `${y}.${m}.${d}`
  }
  const date = new Date(value)
  if (!isNaN(date.getTime())) {
    const y = date.getFullYear()
    const m = `${date.getMonth() + 1}`.padStart(2, '0')
    const d = `${date.getDate()}`.padStart(2, '0')
    return `${y}.${m}.${d}`
  }
  return value
}

interface PrevRaceSpeedSummaryProps {
  items: PrevRaceSpeedSummaryItem[]
  focusedHorseId: string | null
  onSelect?: (horseId: string) => void
  title?: string
}

export default function PrevRaceSpeedSummary({ items, focusedHorseId, onSelect, title = '前走平均時速' }: PrevRaceSpeedSummaryProps) {
  if (!items || items.length === 0) return null

  return (
    <Box sx={{
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 1,
      bgcolor: 'background.paper',
      px: { xs: 0.75, sm: 1 },
      py: 0.5,
      display: 'flex',
      alignItems: 'center',
      gap: 0.75,
      overflowX: 'auto',
      whiteSpace: 'nowrap',
    }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: '0 0 auto' }}>
        {title}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {items.map((item) => {
          const active = focusedHorseId === item.horseId
          const formattedDate = formatDateShort(item.date)

          return (
            <Tooltip
              key={item.horseId}
              title={`${item.surface} ${item.distance}m @ ${item.track}${formattedDate ? `｜${formattedDate}` : ''}`}
            >
              <ButtonBase
                onClick={() => onSelect?.(item.horseId)}
                disableRipple
                className={active ? 'rank-item-button rank-item-button--compact rank-item-button--active' : 'rank-item-button rank-item-button--compact'}
                sx={{
                  flex: '0 0 auto',
                  borderRadius: 1,
                  px: 0.65,
                  py: 0.35,
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  flexDirection: 'column',
                  gap: 0.1,
                  minWidth: 92,
                  maxWidth: 128,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.speed.toFixed(1)} km/h
                </Typography>
              </ButtonBase>
            </Tooltip>
          )
        })}
      </Box>
    </Box>
  )
}
