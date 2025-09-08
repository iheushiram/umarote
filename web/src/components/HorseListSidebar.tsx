import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Chip,
  IconButton,
  Divider,
  Avatar,
  Stack,
  Paper
} from '@mui/material';
import { X, Trophy, Clock, MapPin } from 'lucide-react';
import { HorseEntry } from '../types/horse';

interface HorseListSidebarProps {
  open: boolean;
  onClose: () => void;
  horses: HorseEntry[];
  raceInfo: {
    raceName: string;
    venue: string;
    distance: number;
    surface: string;
  };
}

export default function HorseListSidebar({ open, onClose, horses, raceInfo }: HorseListSidebarProps) {
  const getHorseColor = (frameNo: number) => {
    const colors = {
      1: '#ffffff',
      2: '#111827', 
      3: '#ef4444',
      4: '#3b82f6',
      5: '#10b981',
      6: '#f59e0b',
      7: '#8b5cf6',
      8: '#ec4899'
    };
    return colors[frameNo as keyof typeof colors] || '#6b7280';
  };

  const getTextColor = (frameNo: number) => {
    return frameNo === 1 ? '#111827' : '#ffffff';
  };

  const getRecentForm = (races: any[]) => {
    if (!races || races.length === 0) return '---';
    return races.slice(0, 3).map(race => {
      if (race.position <= 3) {
        return race.position;
      }
      return '○';
    }).join('-');
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 400 },
          maxWidth: '90vw'
        }
      }}
    >
      <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* ヘッダー */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              出走馬一覧
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {raceInfo.raceName}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <X size={20} />
          </IconButton>
        </Box>

        {/* レース情報 */}
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <MapPin size={16} color="#666" />
            <Typography variant="body2">
              {raceInfo.venue} {raceInfo.surface}{raceInfo.distance}m
            </Typography>
          </Stack>
        </Paper>

        <Divider sx={{ mb: 2 }} />

        {/* 出走馬リスト */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <List sx={{ p: 0 }}>
            {horses.map((horse, index) => (
              <ListItem key={horse.horseId} disablePadding sx={{ mb: 1 }}>
                <ListItemButton
                  sx={{
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'grey.200',
                    '&:hover': {
                      bgcolor: 'grey.50',
                      borderColor: 'primary.main'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    {/* 枠番 */}
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        mr: 2,
                        bgcolor: getHorseColor(horse.frameNo),
                        color: getTextColor(horse.frameNo),
                        fontSize: '0.875rem',
                        fontWeight: 'bold'
                      }}
                    >
                      {horse.frameNo}
                    </Avatar>

                    {/* 馬番 */}
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        mr: 2
                      }}
                    >
                      {horse.horseNo}
                    </Box>

                    {/* 馬情報 */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 'bold',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {horse.horse?.name || '不明'}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        <Chip
                          label={`${horse.age}歳`}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                        <Chip
                          label={horse.horse?.sex || '牡'}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                        {horse.popularity && (
                          <Chip
                            label={`${horse.popularity}番人気`}
                            size="small"
                            color="primary"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Stack>

                      {/* 騎手・調教師 */}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {horse.jockey} / {horse.trainer}
                      </Typography>

                      {/* 最近の成績 */}
                      {horse.races && horse.races.length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                          <Trophy size={12} color="#666" style={{ marginRight: 4 }} />
                          <Typography variant="caption" color="text.secondary">
                            {getRecentForm(horse.races)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>

        {/* フッター情報 */}
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'grey.200' }}>
          <Typography variant="caption" color="text.secondary" align="center" display="block">
            {horses.length}頭出走
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}
