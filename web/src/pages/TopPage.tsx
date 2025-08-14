import {
  Typography,
  Box,
  Tab,
  Tabs,
  Card,
  CardContent,

  Chip,
  Button,
  IconButton,
  Stack,
  FormControl,
  Select,
  MenuItem
} from '@mui/material';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VenueBoard, Race } from '../types/horse';

// サンプルデータ
const today = new Date().toISOString().split('T')[0];
const sampleVenues: VenueBoard[] = [
  {
    venue: '東京',
    meetStr: '3回東京8日',
    weather: '晴',
    track: { turf: '良', dirt: '良' },
    cushion: 9.4,
    cushionLabel: '標準',
    races: [
      {
        raceId: '20250813-TOKYO-1',
        date: today,
        venue: '東京',
        raceNo: 1,
        raceName: '3歳未勝利',
        className: '3歳未勝利',
        surface: '芝',
        distance: 1400,
        direction: '左',
        trackCond: '良',
        cushionValue: 9.4,
        fieldSize: 16,
        offAt: '10:10',
        status: '発売中'
      },
      {
        raceId: '20250813-TOKYO-11',
        date: today,
        venue: '東京',
        raceNo: 11,
        raceName: 'フェブラリーS',
        className: 'G1',
        surface: 'ダート',
        distance: 1600,
        direction: '左',
        trackCond: '良',
        fieldSize: 16,
        offAt: '15:40',
        grade: 'G1',
        status: '発売中'
      }
    ]
  },
  {
    venue: '中京',
    meetStr: '1回中京8日',
    weather: '曇',
    track: { turf: '稍', dirt: '良' },
    cushion: 8.2,
    cushionLabel: 'やや軟',
    races: [
      {
        raceId: '20250813-CHUKYO-1',
        date: today,
        venue: '中京',
        raceNo: 1,
        raceName: '3歳未勝利',
        className: '3歳未勝利',
        surface: '芝',
        distance: 1200,
        direction: '左',
        trackCond: '稍',
        cushionValue: 8.2,
        fieldSize: 18,
        offAt: '10:05',
        status: '発売中'
      },
      {
        raceId: '20250813-CHUKYO-12',
        date: today,
        venue: '中京',
        raceNo: 12,
        raceName: '中京記念',
        className: 'G3',
        surface: '芝',
        distance: 1600,
        direction: '左',
        trackCond: '稍',
        cushionValue: 8.2,
        fieldSize: 18,
        offAt: '15:45',
        grade: 'G3',
        status: '発売中'
      }
    ]
  }
];

interface DateTabsProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

const DateTabs = ({ selectedDate, onDateChange }: DateTabsProps) => {
  const dates = [];
  const baseDate = new Date();
  
  // 今日から7日間のタブを生成
  for (let i = -1; i <= 5; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    dates.push({
      value: date.toISOString().split('T')[0],
      label: date.toLocaleDateString('ja-JP', { 
        month: 'numeric', 
        day: 'numeric',
        weekday: 'short'
      }),
      isToday: i === 0,
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    });
  }

  return (
    <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton size="small">
          <ChevronLeft />
        </IconButton>
        
        <Tabs 
          value={selectedDate} 
          onChange={(_, value) => onDateChange(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {dates.map(date => (
            <Tab
              key={date.value}
              value={date.value}
              label={date.label}
              sx={{
                color: date.isWeekend ? 
                  (date.label.includes('日') ? 'error.main' : 'info.main') : 
                  'text.primary',
                fontWeight: date.isToday ? 'bold' : 'normal',
                '&.Mui-selected': {
                  color: date.isWeekend ? 
                    (date.label.includes('日') ? 'error.main' : 'info.main') : 
                    'primary.main'
                }
              }}
            />
          ))}
        </Tabs>
        
        <IconButton size="small">
          <ChevronRight />
        </IconButton>
        
        <Button 
          variant="outlined" 
          size="small" 
          startIcon={<CalendarDays size={16} />}
        >
          今日
        </Button>
      </Stack>
    </Box>
  );
};

interface RaceCardProps {
  race: Race;
  onClick: (raceId: string) => void;
}

const RaceCard = ({ race, onClick }: RaceCardProps) => {
  const getGradeColor = (grade?: string) => {
    switch (grade) {
      case 'G1': return 'secondary';
      case 'G2': return 'info'; 
      case 'G3': return 'success';
      case 'OP': return 'default';
      default: return undefined;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '発売中': return 'success';
      case '発走前': return 'warning';
      case '確定': return 'default';
      default: return 'default';
    }
  };

  return (
    <Card 
      sx={{ 
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
        mb: 1,
        minHeight: 100
      }}
      onClick={() => onClick(race.raceId)}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack spacing={0.5} sx={{ flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                {race.raceNo}R
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {race.offAt}
              </Typography>
            </Stack>
            
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
              {race.raceName}
            </Typography>
            
            <Typography variant="body2" color="text.secondary">
              {race.surface}{race.distance}m {race.courseConf || ''} {race.fieldSize}頭
            </Typography>
          </Stack>
          
          <Stack alignItems="flex-end" spacing={0.5}>
            <Chip 
              label={race.status} 
              size="small" 
              color={getStatusColor(race.status)}
              variant={race.status === '発売中' ? 'filled' : 'outlined'}
            />
            
            {race.grade && (
              <Chip 
                label={race.grade} 
                size="small" 
                color={getGradeColor(race.grade)}
              />
            )}
            
            {race.win5 && (
              <Chip 
                label="WIN5" 
                size="small" 
                color="primary"
                variant="outlined"
              />
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

interface VenueBoardCardProps {
  venue: VenueBoard;
  onRaceClick: (raceId: string) => void;
}

const VenueBoardCard = ({ venue, onRaceClick }: VenueBoardCardProps) => {
  return (
    <Card sx={{ height: 'fit-content' }}>
      <CardContent>
        <Stack spacing={2}>
          {/* ヘッダー情報 */}
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
              {venue.meetStr}
            </Typography>
            
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip label={venue.weather} size="small" />
              <Chip label={`芝:${venue.track.turf}`} size="small" />
              <Chip label={`ダ:${venue.track.dirt}`} size="small" />
              
              {venue.cushion && (
                <Chip 
                  label={`クッション値 ${venue.cushion} (${venue.cushionLabel})`}
                  size="small"
                  color="info"
                />
              )}
            </Stack>
          </Box>
          
          {/* レースカード一覧 */}
          <Stack spacing={1}>
            {venue.races.map(race => (
              <RaceCard 
                key={race.raceId} 
                race={race} 
                onClick={onRaceClick}
              />
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default function TopPage() {
  const [selectedDate, setSelectedDate] = useState(today);
  const [surfaceFilter, setSurfaceFilter] = useState<'all' | 'turf' | 'dirt'>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | 'stakes' | 'graded'>('all');
  const navigate = useNavigate();

  const handleRaceClick = (raceId: string) => {
    navigate(`/races/${raceId}`);
  };

  const filteredVenues = sampleVenues.map(venue => ({
    ...venue,
    races: venue.races.filter(race => {
      if (surfaceFilter !== 'all' && 
          ((surfaceFilter === 'turf' && race.surface !== '芝') ||
           (surfaceFilter === 'dirt' && race.surface !== 'ダート'))) {
        return false;
      }
      
      if (gradeFilter === 'stakes' && !race.grade) return false;
      if (gradeFilter === 'graded' && (!race.grade || race.grade === 'OP')) return false;
      
      return true;
    })
  })).filter(venue => venue.races.length > 0);

  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 'bold' }}>
        競馬開催情報
      </Typography>
      
      {/* 日付選択 */}
      <DateTabs selectedDate={selectedDate} onDateChange={setSelectedDate} />
      
      {/* クイックフィルタ */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={surfaceFilter}
            onChange={(e) => setSurfaceFilter(e.target.value as 'all' | 'turf' | 'dirt')}
          >
            <MenuItem value="all">芝・ダート</MenuItem>
            <MenuItem value="turf">芝のみ</MenuItem>
            <MenuItem value="dirt">ダートのみ</MenuItem>
          </Select>
        </FormControl>
        
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value as 'all' | 'stakes' | 'graded')}
          >
            <MenuItem value="all">全レース</MenuItem>
            <MenuItem value="stakes">重賞のみ</MenuItem>
            <MenuItem value="graded">G1-G3のみ</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      
      {/* 開催ボード */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { 
          xs: '1fr', 
          md: 'repeat(2, 1fr)', 
          lg: 'repeat(3, 1fr)' 
        }, 
        gap: 3 
      }}>
        {filteredVenues.map(venue => (
          <VenueBoardCard 
            key={venue.venue}
            venue={venue} 
            onRaceClick={handleRaceClick}
          />
        ))}
      </Box>
      
      {filteredVenues.length === 0 && (
        <Box textAlign="center" sx={{ mt: 4 }}>
          <Typography variant="h6" color="text.secondary">
            該当するレースがありません
          </Typography>
        </Box>
      )}
    </Box>
  );
}