import express from 'express';
import dotenv from 'dotenv';

console.log('🚀 Minimal server starting...');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.json({ message: 'Minimal server is running!' });
});

app.listen(PORT, () => {
  console.log(`✅ Minimal server running on port ${PORT}`);
});
