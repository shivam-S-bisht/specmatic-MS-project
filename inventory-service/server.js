const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SWAGGER_PATH = process.env.SWAGGER_PATH || path.join(__dirname, '..', 'contracts', 'inventory-api.yaml');

// In-memory stock DB
const items = {
  1: { id: 1, name: 'Laptop', price: 1200, stock: 50 }
};

// Serve swagger spec
app.get('/swagger.json', (req, res) => {
  try {
    const fileContents = fs.readFileSync(SWAGGER_PATH, 'utf8');
    res.json(yaml.load(fileContents));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to read swagger file' });
  }
});

// GET /items/:id
app.get('/items/:id', (req, res) => {
  const idVal = parseInt(req.params.id);
  if (isNaN(idVal)) {
    return res.status(200).json({ error: 'Invalid ID format' });
  }

  const item = items[idVal];
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json(item);
});

// POST /items/reserve
app.post('/items/reserve', (req, res) => {
  const { id, quantity } = req.body;

  // Validate fields and type checks for resiliency verification
  if (id === undefined || quantity === undefined) {
    return res.status(400).json({ error: 'Out of stock or invalid request' });
  }

  if (typeof id !== 'number' || !Number.isInteger(id) || typeof quantity !== 'number' || !Number.isInteger(quantity)) {
    return res.status(400).json({ error: 'Out of stock or invalid request' });
  }

  const item = items[id];
  if (!item || item.stock < quantity) {
    return res.status(400).json({ error: 'Out of stock or invalid request' });
  }

  item.stock -= quantity;
  console.log(`Reserved ${quantity} of item ${id}. Remaining stock: ${item.stock}`);
  res.json({ status: 'success' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Inventory Service running on port ${PORT}`);
});
