require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const admsRoutes = require('./routes/adms');
const leaveRoutes = require('./routes/leave');
const correctionRoutes = require('./routes/corrections');
const reportRoutes = require('./routes/reports');
require('./jobs/dailyAlphaSweeper'); // fallback: tandai alpha untuk yang tak ada log sama sekali

const app = express();
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// --- Endpoint mesin X105 (protokol ADMS, TIDAK pakai auth JWT karena mesin
//     yang connect, bukan browser. Keamanan diamankan lewat isolasi jaringan
//     LAN sekolah - server ini idealnya tidak diekspos langsung ke internet).
app.use('/iclock', admsRoutes);

// --- Endpoint aplikasi (dipakai frontend, wajib auth JWT Supabase) ---
app.use('/api/leave', leaveRoutes);
app.use('/api/corrections', correctionRoutes);
app.use('/api/reports', reportRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server absensi jalan di port ${PORT}`);
  console.log(`Arahkan X105 ke: http://<IP-server-ini>:${PORT}/iclock/cdata`);
});
