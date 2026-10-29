import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Backend Health and Diagnostics Endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Global Transport Empire Backend Service',
      version: '0.2.0',
      edition: 'Alpha World Architecture',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      capabilities: {
        gameEngine: 'Three.js / WebGL',
        audioSynth: 'Web Audio API',
        apiState: 'Operational',
        constructionSystem: 'Active',
      },
    });
  });

  // Game Configuration & Sector World Seed API
  app.get('/api/game/config', (_req, res) => {
    res.json({
      gameName: 'Global Transport Empire',
      version: '0.2.0',
      company: {
        name: 'Apex Transport Global',
        startingCash: 250000,
        currency: 'USD',
      },
      grid: {
        width: 24,
        height: 24,
        cellSize: 2,
      },
      tickRateMs: 1000,
      activeModules: [
        { id: 'spatial_grid', status: 'operational' },
        { id: 'road_network', status: 'operational' },
        { id: 'facility_construction', status: 'operational' },
        { id: 'district_classification', status: 'operational' },
      ],
    });
  });

  // Serve static files in production or hook into Vite dev middleware in development
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Global Transport Empire] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Global Transport Empire] Fatal server startup error:', err);
  process.exit(1);
});
