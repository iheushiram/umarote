import React from 'react'
import { Drawer, Box, IconButton } from '@mui/material'
import { X } from 'lucide-react'
import RaceLevelRankPanel from './RaceLevelRankPanel'

type Variant = 'temporary' | 'persistent'

export default function RaceLevelSidebar({
  open,
  onClose,
  variant = 'temporary',
  onToggleCoRunners,
  expandedMap,
  renderCoRunnerContent,
}: {
  open: boolean
  onClose: () => void
  variant?: Variant
  onToggleCoRunners?: (horseId: string) => void
  expandedMap?: Record<string, boolean>
  renderCoRunnerContent?: (horseId: string) => React.ReactNode
}) {
  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      variant={variant}
      sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', sm: 380 }, maxWidth: '90vw', zIndex: 1300 } }}
    >
      <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <IconButton aria-label="閉じる" onClick={onClose} size="small">
            <X size={20} />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <RaceLevelRankPanel
            onToggleCoRunners={onToggleCoRunners}
            expandedMap={expandedMap}
            renderCoRunnerContent={renderCoRunnerContent}
          />
        </Box>
      </Box>
    </Drawer>
  )
}
