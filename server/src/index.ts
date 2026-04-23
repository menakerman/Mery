import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDb } from './db';
import authRoutes from './routes/auth';
import diverRoutes from './routes/divers';
import certRoutes from './routes/certifications';
import teamRoutes from './routes/teams';
import userRoutes from './routes/users';
import uploadRoutes from './routes/upload';
import diverAuthRoutes from './routes/diverAuth';
import configRoutes from './routes/config';
import activityRoutes from './routes/activities';
import diverCertRoutes from './routes/diverCerts';

const app = express();
const PORT = process.env.PORT || 3001;

const isProduction = process.env.NODE_ENV === 'production';

app.use(cors(isProduction ? {} : { origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json());

// Init database
initDb();

// API Routes
app.use('/api/diver-auth', diverAuthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/divers', diverRoutes);
app.use('/api/certifications', certRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/config', configRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/diver-certs', diverCertRoutes);

// In production, serve the built client
if (isProduction) {
  // Resolve client dist path (fallback to cwd for Railway)
  const fs = require('fs');
  let clientDist = path.join(__dirname, '..', '..', '..', '..', 'client', 'dist');
  if (!fs.existsSync(clientDist)) {
    clientDist = path.join(process.cwd(), 'client', 'dist');
  }
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
