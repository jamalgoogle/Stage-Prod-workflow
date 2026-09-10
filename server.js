const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const ENV = process.env.APP_ENV || 'unknown';

app.get('/', (req, res) => {
  res.send(`Hello! Running in: ${ENV}`);
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => console.log(`Running on port ${PORT} [${ENV}]`));