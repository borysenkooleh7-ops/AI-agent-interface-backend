const express = require('express');
const app = express();
const PORT = 5000;

app.get('/', (req, res) => {
  res.json({ message: 'Test server is running!' });
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});
