import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider
} from '@mui/material';
import { X } from 'lucide-react';
import DistanceAnalysis from './RaceAnalysis';

interface AnalysisSidebarProps {
  open: boolean;
  onClose: () => void;
  raceId: string;
  currentDistance: number;
  currentSurface: string;
  currentVenue: string;
}

export default function AnalysisSidebar({ 
  open, 
  onClose, 
  raceId, 
  currentDistance, 
  currentSurface, 
  currentVenue 
}: AnalysisSidebarProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: '80%', md: '70%', lg: '60%' },
          maxWidth: '90vw'
        }
      }}
    >
      <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* ヘッダー */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            レース分析
          </Typography>
          <IconButton onClick={onClose} size="small">
            <X size={20} />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* 分析コンテンツ */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <DistanceAnalysis 
            raceId={raceId}
            currentDistance={currentDistance}
            currentSurface={currentSurface}
            currentVenue={currentVenue}
          />
        </Box>
      </Box>
    </Drawer>
  );
}
