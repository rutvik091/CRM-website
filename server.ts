import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { apiRouter } from './src/server/routes';
import { ReminderEngine } from './src/server/reminderEngine';
import { db } from './src/server/db';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Cookie parser for secure HTTP-only sessions
app.use(cookieParser());

// Body parser (handles large document uploads up to 35MB)
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

// Mount API Routes
app.use('/api', apiRouter);

// Daily Reminder & Backup Scheduler (Asia/Kolkata 10:00 AM IST)
let lastCheckedDay = '';

async function checkDailyJobs() {
  try {
    const todayIST = ReminderEngine.getISTDate();
    const istHour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false
      }).format(new Date()),
      10
    );

    // Trigger daily check at or after 10:00 AM IST once per day
    if (todayIST !== lastCheckedDay && istHour >= 10) {
      lastCheckedDay = todayIST;
      console.log(`[Job Scheduler] Executing 10:00 AM IST daily reminder engine & auto backup for ${todayIST}...`);
      const remResult = await ReminderEngine.evaluateReminders();
      console.log(`[Job Scheduler] Reminders created: ${remResult.created}, skipped: ${remResult.skipped}`);

      // Daily backup
      try {
        const backupFile = await db.createBackupSnapshot('daily');
        console.log(`[Job Scheduler] Daily backup created: ${backupFile}`);
      } catch (backupErr) {
        console.error('[Job Scheduler] Error creating daily backup:', backupErr);
      }
    }
  } catch (err) {
    console.error('[Job Scheduler] Error checking daily jobs:', err);
  }
}

// Check every 60 seconds
setInterval(checkDailyJobs, 60 * 1000);
// Also run a soft check shortly after startup
setTimeout(checkDailyJobs, 4000);

async function startServer() {
  // Initialize real PostgreSQL database and run migrations
  console.log('[PostgreSQL] Initializing database...');
  await db.init();

  if (process.env.NODE_ENV === 'production') {
    // Production static serving
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    // Development with Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  MY INVESTMENT MANAGER - Core Full-Stack Server Online`);
    console.log(`  Port: ${PORT} | Timezone: Asia/Kolkata (IST)`);
    console.log(`  Database: PostgreSQL Engine Ready`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`======================================================\n`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
});
