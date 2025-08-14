import {
  Typography,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Button
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useHorseStore } from '../store/horseStore'

const HorseList = () => {
  const navigate = useNavigate()
  const { horses } = useHorseStore()

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        競走馬一覧
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>馬名</TableCell>
              <TableCell>性別</TableCell>
              <TableCell>生年</TableCell>
              <TableCell>調教師</TableCell>
              <TableCell>獲得賞金</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {horses.map((horse) => (
              <TableRow key={horse.id}>
                <TableCell>{horse.name}</TableCell>
                <TableCell>{horse.sex}</TableCell>
                <TableCell>{horse.birthYear}</TableCell>
                <TableCell>{horse.trainer}</TableCell>
                <TableCell>{horse.earnings.toLocaleString()}円</TableCell>
                <TableCell>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => navigate(`/horse/${horse.id}`)}
                  >
                    詳細
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  )
}

export default HorseList 

