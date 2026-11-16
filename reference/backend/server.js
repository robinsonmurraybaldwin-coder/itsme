const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serves the frontend folder so the whole app runs from one port (no CORS needed).
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// In-memory "database" — resets every time the server restarts.
let account = {
  bankName: '데모뱅크',
  accountNumber: '110-222-333444',
  balance: 1250000,
};

let transactions = [
  { id: 3, date: '2026-11-14 09:12', name: '편의점', amount: -4500 },
  { id: 2, date: '2026-11-13 18:40', name: '월급', amount: 2500000 },
  { id: 1, date: '2026-11-10 11:05', name: '넷플릭스', amount: -17000 },
];
let nextId = 4;

app.get('/api/account', (req, res) => {
  res.json(account);
});

app.get('/api/transactions', (req, res) => {
  // Most recent first, same ordering as the real app's history screen.
  const sorted = [...transactions].sort((a, b) => b.id - a.id);
  res.json(sorted);
});

app.post('/api/transfer', (req, res) => {
  const { toName, toAccount, amount } = req.body;

  if (!toName || !toAccount || !Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: '입력값이 올바르지 않습니다.' });
  }
  if (amount > account.balance) {
    return res.status(400).json({ error: '잔액이 부족합니다.' });
  }

  account.balance -= amount;
  const transaction = {
    id: nextId++,
    date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    name: toName,
    amount: -amount,
  };
  transactions.push(transaction);

  res.json({ account, transaction });
});

app.listen(PORT, () => {
  console.log(`DemoBank reference server running at http://localhost:${PORT}`);
});
