import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDb } from './db.js';
import { Issue } from './models/Issue.js';
import issuesRouter from './routes/issues.js';
import authRouter from './routes/auth.js';
import notificationsRouter from './routes/notifications.js';
import dashboardRouter from './routes/dashboard.js';
import aiRouter from './routes/ai.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mongo: true });
});

app.get('/api/bootstrap', async (_req, res) => {
  try {
    const issues = await Issue.find().sort({ id: -1 }).lean();
    const votes = {};
    const comments = {};
    const issueList = issues.map((i) => {
      votes[i.id] = i.voteMap && typeof i.voteMap === 'object' ? { ...i.voteMap } : {};
      comments[i.id] = Array.isArray(i.comments) ? i.comments : [];
      const { _id, voteMap: _voteMap, comments: _c, __v, ...rest } = i;
      return rest;
    });

    res.json({ issues: issueList, votes, comments });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use('/api/issues', issuesRouter);
app.use('/api/auth', authRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ai', aiRouter);

const candidatePorts = [Number(process.env.PORT) || 5000, 5001, 5002, 5003, 5004];
const uniquePorts = [...new Set(candidatePorts.filter((port) => Number.isInteger(port) && port > 0))];

connectDb()
  .then(() => {
    const HOST = process.env.HOST || '0.0.0.0';
    let portIndex = 0;

    const startServer = (port) => {
      process.env.PORT = String(port);
      const server = app.listen(port, HOST, () => {
        console.log(`CitySpark API listening on http://${HOST}:${port}`);
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && portIndex < uniquePorts.length - 1) {
          const nextPort = uniquePorts[portIndex + 1];
          portIndex += 1;
          console.warn(`Port ${port} is busy, retrying on ${nextPort}...`);
          startServer(nextPort);
          return;
        }

        if (err.code === 'EADDRINUSE') {
          console.error(
            `\nUnable to start CitySpark API. Ports ${uniquePorts.join(', ')} are all in use.\n` +
            `  • Stop the other app or set a free PORT value before starting the server.\n`
          );
          process.exit(1);
        }

        throw err;
      });
    };

    startServer(uniquePorts[0]);
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
