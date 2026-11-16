const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ---------- in-memory mock data ----------
let account = {
  bankName: '마이뱅크',
  productName: '보통예금(마이뱅크 W통장)',
  accountNumber: '110-222-333444',
  balance: 1250000,
};

let recipients = [
  { id: 1, name: '김민지', bank: '제일', account: '110-234-567890', lastDate: '2026.11.14' },
  { id: 2, name: '박서준', bank: '한빛', account: '220-987-654321', lastDate: '2026.11.10' },
  { id: 3, name: '이수현', bank: '새길', account: '330-111-222333', lastDate: '2026.11.05' },
  { id: 4, name: '최도윤', bank: '하늘', account: '440-555-666777', lastDate: '2026.10.28' },
];

let transactions = [
  { id: 4, date: '2026.11.14', time: '09:12', name: '편의점', amount: -4500, balanceAfter: 1250000, category: '출금', method: '스마트뱅킹', counterBank: '-', counterAccount: '-', counterHolder: '-' },
  { id: 3, date: '2026.11.13', time: '18:40', name: '월급', amount: 2500000, balanceAfter: 1254500, category: '입금', method: '타행이체', counterBank: '새길', counterAccount: '-', counterHolder: '(주)데모컴퍼니' },
  { id: 2, date: '2026.11.10', time: '11:05', name: '넷플릭스', amount: -17000, balanceAfter: -1245500, category: '출금', method: '자동이체', counterBank: '-', counterAccount: '-', counterHolder: '-' },
  { id: 1, date: '2026.11.05', time: '08:00', name: '이수현', amount: -30000, balanceAfter: -1228500, category: '출금', method: '스마트뱅킹', counterBank: '새길', counterAccount: '330-111-222333', counterHolder: '이수현' },
];
let nextTxId = 5;
let nextRecipientId = 5;

app.get('/api/account', (req, res) => res.json(account));

app.get('/api/recipients', (req, res) => {
  const sorted = [...recipients].sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  res.json(sorted);
});

app.get('/api/transactions', (req, res) => {
  const sorted = [...transactions].sort((a, b) => b.id - a.id);
  res.json(sorted);
});

app.post('/api/transfer', (req, res) => {
  const { toName, toBank, toAccount, amount } = req.body;

  if (!toName || !toBank || !toAccount || !Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: '입력값이 올바르지 않습니다.' });
  }
  if (amount > account.balance) {
    return res.status(400).json({ error: '잔액이 부족합니다.' });
  }

  account.balance -= amount;

  const now = new Date();
  const transaction = {
    id: nextTxId++,
    date: now.toISOString().slice(0, 10).replaceAll('-', '.'),
    time: now.toTimeString().slice(0, 5),
    name: toName,
    amount: -amount,
    balanceAfter: account.balance,
    category: '출금',
    method: '스마트뱅킹',
    counterBank: toBank,
    counterAccount: toAccount,
    counterHolder: toName,
  };
  transactions.push(transaction);

  const existing = recipients.find((r) => r.account === toAccount);
  if (existing) {
    existing.lastDate = transaction.date;
  } else {
    recipients.push({ id: nextRecipientId++, name: toName, bank: toBank, account: toAccount, lastDate: transaction.date });
  }

  res.json({ account, transaction });
});

app.listen(PORT, () => {
  console.log(`DemoBank reference server running at http://localhost:${PORT}`);
});
