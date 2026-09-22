import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 5000;

// Connect to database

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
