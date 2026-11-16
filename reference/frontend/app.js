const won = (n) => `${n.toLocaleString('ko-KR')}원`;

// ---------- 화면 전환 ----------
function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.toggle('active', el.id === `screen-${name}`);
  });
  document.querySelectorAll('.tab').forEach((el) => {
    el.classList.toggle('active', el.dataset.screen === name);
  });

  if (name === 'history') loadTransactions();
  if (name === 'dashboard') loadAccount();
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => showScreen(btn.dataset.screen));
});
document.querySelectorAll('[data-back]').forEach((btn) => {
  btn.addEventListener('click', () => showScreen(btn.dataset.back));
});
document.getElementById('btn-transfer').addEventListener('click', () => showScreen('transfer'));

// ---------- 계좌 조회 (GET) ----------
async function loadAccount() {
  const res = await fetch('/api/account');
  const account = await res.json();
  document.getElementById('bank-name').textContent = account.bankName;
  document.getElementById('account-number').textContent = account.accountNumber;
  document.getElementById('balance').textContent = won(account.balance);
}

// ---------- 이체내역 조회 (GET) ----------
async function loadTransactions() {
  const res = await fetch('/api/transactions');
  const items = await res.json();
  const list = document.getElementById('history-list');

  list.innerHTML = items
    .map((t) => {
      const isPositive = t.amount > 0;
      return `
        <li class="history-item">
          <div class="meta">
            <span class="name">${t.name}</span>
            <span class="date">${t.date}</span>
          </div>
          <span class="amount ${isPositive ? 'positive' : 'negative'}">
            ${isPositive ? '+' : ''}${won(t.amount)}
          </span>
        </li>`;
    })
    .join('');
}

// ---------- 이체 금액 입력 ----------
const amountInput = document.getElementById('amount');
const amountDisplay = document.getElementById('amount-display');

function setAmount(value) {
  amountInput.value = value;
  amountDisplay.textContent = won(value);
}

document.querySelectorAll('[data-add]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const current = Number(amountInput.value);
    setAmount(current + Number(btn.dataset.add));
  });
});
document.getElementById('btn-reset-amount').addEventListener('click', () => setAmount(0));

// ---------- 이체 실행 (POST) ----------
document.getElementById('transfer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('transfer-error');
  errorEl.textContent = '';

  const body = {
    toName: document.getElementById('to-name').value,
    toAccount: document.getElementById('to-account').value,
    amount: Number(amountInput.value),
  };

  const res = await fetch('/api/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();

  if (!res.ok) {
    errorEl.textContent = data.error;
    return;
  }

  e.target.reset();
  setAmount(0);
  showScreen('dashboard');
});

// ---------- 초기 로드 ----------
loadAccount();
