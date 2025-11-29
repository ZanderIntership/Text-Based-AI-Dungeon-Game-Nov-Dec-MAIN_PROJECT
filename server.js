const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/static', express.static(path.join(__dirname, 'static')));

app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});
app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'about.html'));
});
app.get('/track', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'track_spend.html'));
});
app.get('/networth', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'networth.html'));
});

app.use('/', express.static(path.join(__dirname, 'templates')));

let TRANSACTIONS = [];
let ASSETS = [];
let ASSET_HISTORY = [];
let NEXT_HISTORY_ID = 1;
app.get('/api/transactions', (req, res) => {
  res.json(TRANSACTIONS.slice().reverse());
});

app.post('/api/transactions', (req, res) => {
  const { date, description, amount, category, type } = req.body;
  const tx = {
    date: date || new Date().toISOString().slice(0,10),
    description: description || 'No description',
    amount: (Number(amount) || 0).toFixed(2),
    category: category || 'Other',
    type: type || 'expense'
  };
  TRANSACTIONS.push(tx);
  res.json({ success: true, tx });
});

app.get('/api/assets', (req, res) => {
  res.json(ASSETS);
});

app.post('/api/assets', (req, res) => {
  const { name, price, account } = req.body;
  const a = { name: name||'Unnamed', price: Number(price)||0, account: account||'Unknown' };
  ASSETS.push(a);
  res.json({ success: true, asset: a });
});

app.post('/api/assets/add-amount', (req, res) => {
  const { index, amount } = req.body;
  const idx = Number(index);
  const amt = Number(amount) || 0;
  if (Number.isNaN(idx) || idx < 0 || idx >= ASSETS.length) {
    return res.status(400).json({ success: false, error: 'Invalid asset index' });
  }
  const current = Number(ASSETS[idx].price || 0);
  const newPrice = Number((current) + amt);
  if (newPrice < 0) {
    return res.status(400).json({ success: false, error: 'Asset price cannot go below zero', currentPrice: current });
  }
  ASSETS[idx].price = newPrice;
  res.json({ success: true, asset: ASSETS[idx], index: idx });
});

app.get('/api/assets/history', (req, res) => {
  res.json(ASSET_HISTORY.slice().reverse());
});

app.post('/api/assets/undo', (req, res) => {
  const { historyId } = req.body;
  const hid = Number(historyId);
  if (Number.isNaN(hid)) return res.status(400).json({ success: false, error: 'Invalid history id' });
  const entry = ASSET_HISTORY.find(h => h.id === hid);
  if (!entry) return res.status(404).json({ success: false, error: 'History entry not found' });
  if (entry.undone) return res.status(400).json({ success: false, error: 'History entry already undone' });
  const idx = Number(entry.assetIndex);
  if (Number.isNaN(idx) || idx < 0 || idx >= ASSETS.length) return res.status(400).json({ success: false, error: 'Invalid asset index in history' });
  const current = Number(ASSETS[idx].price || 0);
  if (current !== Number(entry.next)) {
    return res.status(400).json({ success: false, error: 'Asset current value has changed since that history entry; cannot safely undo', currentPrice: current, expected: entry.next });
  }
  ASSETS[idx].price = Number(entry.prev);
  entry.undone = true;
  ASSET_HISTORY.push({ id: NEXT_HISTORY_ID++, assetIndex: idx, delta: Number(entry.prev) - Number(entry.next), prev: Number(entry.next), next: Number(entry.prev), action: 'undo', timestamp: Date.now(), undone: false, undoneEntry: hid });
  res.json({ success: true, asset: ASSETS[idx], undoneHistoryId: hid });
});

app.post('/api/reset', (req, res) => {
  TRANSACTIONS = [];
  ASSETS = [];
  res.json({ success: true, message: 'Data cleared' });
});

app.get('/api/metrics', (req, res) => {
  let total = 0, income = 0, expenses = 0;
  for (const t of TRANSACTIONS) {
    const amt = Number(t.amount)||0;
    if (t.type === 'income') { income += amt; total += amt } else { expenses += amt; total -= amt }
  }
  const savingsRate = income > 0 ? Math.round((income - expenses)/income*100) : null;
  res.json({ total_balance: total.toFixed(2), monthly_income: income.toFixed(2), monthly_expenses: expenses.toFixed(2), savings_rate: savingsRate?`${savingsRate}%`:'—' });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
