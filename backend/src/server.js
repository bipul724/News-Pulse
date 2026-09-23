import 'dotenv/config';
import app from './app.js';
import { recoverInterruptedJobs } from './services/ingestionService.js';

const PORT = process.env.PORT || 5000;

// Jobs left queued/running by a previous process can never finish, so close them
// out before accepting requests. A database outage here must not stop the API.
try {
  const recovered = await recoverInterruptedJobs();
  if (recovered) console.log(`Marked ${recovered} interrupted ingestion job(s) as failed.`);
} catch (err) {
  console.error('Could not check for interrupted ingestion jobs:', err.message);
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
