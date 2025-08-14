import {
  Typography,
  Paper,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Box,
  Stack
} from '@mui/material'
import { useParams, useNavigate } from 'react-router-dom'
import { useHorseStore } from '../store/horseStore'

const HorseDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { horses } = useHorseStore()
  const horse = horses.find(h => h.id === id)

  if (!horse) {
    return (
      <Typography variant="h6" color="error">
        馬が見つかりません
      </Typography>
    )
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
      <Box sx={{ mb: 2 }}>
        <Button variant="outlined" onClick={() => navigate('/')}>
          戻る
        </Button>
      </Box>
      
      <Typography variant="h4" component="h1" gutterBottom>
        {horse.name}
      </Typography>

      <Paper sx={{ p: 2, mb: 4 }}>
        <Stack direction="row" flexWrap="wrap" gap={4}>
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="subtitle2" color="text.secondary">生年</Typography>
            <Typography>{horse.birthYear}年</Typography>
          </Box>
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="subtitle2" color="text.secondary">性別</Typography>
            <Typography>{horse.sex}</Typography>
          </Box>
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="subtitle2" color="text.secondary">毛色</Typography>
            <Typography>{horse.color}</Typography>
          </Box>
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="subtitle2" color="text.secondary">父</Typography>
            <Typography>{horse.father}</Typography>
          </Box>
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="subtitle2" color="text.secondary">母</Typography>
            <Typography>{horse.mother}</Typography>
          </Box>
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="subtitle2" color="text.secondary">調教師</Typography>
            <Typography>{horse.trainer}</Typography>
          </Box>
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="subtitle2" color="text.secondary">馬主</Typography>
            <Typography>{horse.owner}</Typography>
          </Box>
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="subtitle2" color="text.secondary">生産者</Typography>
            <Typography>{horse.breeder}</Typography>
          </Box>
        </Stack>
      </Paper>

      <Typography variant="h5" component="h2" gutterBottom>
        レース結果
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>日付</TableCell>
              <TableCell>レース名</TableCell>
              <TableCell>コース</TableCell>
              <TableCell>距離</TableCell>
              <TableCell>着順</TableCell>
              <TableCell>騎手</TableCell>
              <TableCell>タイム</TableCell>
              <TableCell>オッズ</TableCell>
              <TableCell>人気</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {horse.results.map((result) => (
              <TableRow key={result.id}>
                <TableCell>{result.date}</TableCell>
                <TableCell>{result.raceName}</TableCell>
                <TableCell>{result.courseType}</TableCell>
                <TableCell>{result.distance}m</TableCell>
                <TableCell>{result.finishPosition}着</TableCell>
                <TableCell>{result.jockey}</TableCell>
                <TableCell>{result.time}</TableCell>
                <TableCell>{result.odds}</TableCell>
                <TableCell>{result.popularity}番人気</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

export default HorseDetail 