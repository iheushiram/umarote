
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

const HorseTable = () => {
  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="horse racing table">
        <TableHead>
          <TableRow>
            <TableCell align="center">枠/番</TableCell>
            <TableCell align="center">印</TableCell>
            <TableCell>馬名</TableCell>
            <TableCell align="center">騎手<br />斤量</TableCell>
            <TableCell align="center">前走</TableCell>
            <TableCell align="center">2走</TableCell>
            <TableCell align="center">3走</TableCell>
            <TableCell align="center">4走</TableCell>
            <TableCell align="center">5走</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {/* Example row, replace with dynamic data */}
          <TableRow>
            <TableCell align="center">1</TableCell>
            <TableCell align="center">--</TableCell>
            <TableCell>エコロヴァルツ</TableCell>
            <TableCell align="center">武豊<br />492kg</TableCell>
            <TableCell align="center">2023.08.13<br />1着</TableCell>
            <TableCell align="center">2023.07.08<br />1着</TableCell>
            <TableCell align="center">-</TableCell>
            <TableCell align="center">-</TableCell>
            <TableCell align="center">-</TableCell>
          </TableRow>
          {/* Add more rows as needed */}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default HorseTable; 