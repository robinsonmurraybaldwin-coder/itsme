const won = (n) => `${n.toLocaleString('ko-KR')}원`;

// 200000 -> "20만원" 같은 간이 한글 금액 표기 (완벽한 한글 수사 변환은 아님)
function amountInWords(n) {
  if (!n) return '';
  const eok = Math.floor(n / 100000000);
  let rest = n % 100000000;
  const man = Math.floor(rest / 10000);
  rest = rest % 10000;
  const parts = [];
  if (eok) parts.push(`${eok}억`);
  if (man) parts.push(`${man}만`);
  if (rest) parts.push(`${rest}`);
  return parts.join(' ') + '원';
}

const state = { account: null, recipients: [], transactions: [], selected: null, amount: 0 };

// ---------- 화면 전환 ----------
function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.toggle('active', el.id === `screen-${name}`);
  });
  if (name === 'dashboard') loadAccount();
  if (name === 'pick') loadRecipients();
  if (name === 'history') loadTransactions();
}

document.querySelectorAll('[data-back]').forEach((el) => {
  el.addEventListener('click', () => showScreen(el.dataset.back));
});
document.querySelectorAll('[data-screen]').forEach((el) => {
  el.addEventListener('click', () => showScreen(el.dataset.screen));
});
document.getElementById('btn-transfer').addEventListener('click', () => showScreen('pick'));

// ---------- 메뉴 / 바텀시트 오버레이 ----------
document.querySelectorAll('[data-open-menu]').forEach((el) =>
  el.addEventListener('click', () => document.getElementById('menu-overlay').classList.add('open'))
);
document.querySelectorAll('[data-close-menu]').forEach((el) =>
  el.addEventListener('click', () => document.getElementById('menu-overlay').classList.remove('open'))
);
document.querySelectorAll('[data-close-sheet]').forEach((el) =>
  el.addEventListener('click', () => document.getElementById('detail-sheet').classList.remove('open'))
);

// ---------- 1. 계좌 조회 (GET) ----------
async function loadAccount() {
  const res = await fetch('/api/account');
  state.account = await res.json();
  document.getElementById('bank-name').textContent = state.account.bankName;
  document.getElementById('product-name').textContent = state.account.productName;
  document.getElementById('account-number').textContent = state.account.accountNumber;
  document.getElementById('balance').textContent = won(state.account.balance);
  document.getElementById('menu-username').textContent = '회원';
}

// ---------- 2. 최근 이체 받는사람 조회 (GET) ----------
async function loadRecipients() {
  const res = await fetch('/api/recipients');
  state.recipients = await res.json();
  document.getElementById('recent-count').textContent = state.recipients.length;

  const list = document.getElementById('recipient-list');
  list.innerHTML = state.recipients
    .map(
      (r, i) => `
      <li class="recipient-item" data-index="${i}">
        <span class="bank-dot">${r.bank[0]}</span>
        <div class="recipient-main">
          <div class="recipient-name">${r.name}</div>
          <div class="recipient-sub">${r.bank} ${r.account}</div>
        </div>
        <div class="recipient-date">최종이체 ${r.lastDate}</div>
      </li>`
    )
    .join('');

  list.querySelectorAll('.recipient-item').forEach((el) => {
    el.addEventListener('click', () => selectRecipient(state.recipients[Number(el.dataset.index)]));
  });
}

function selectRecipient(recipient) {
  state.selected = recipient;
  state.amount = 0;

  document.getElementById('amount-from-bank').textContent = state.account.bankName[0];
  document.getElementById('amount-from-account').textContent = `${state.account.bankName} ${state.account.accountNumber}`;
  document.getElementById('amount-from-balance').textContent = won(state.account.balance);

  document.getElementById('amount-to-bank').textContent = recipient.bank[0];
  document.getElementById('amount-to-name').textContent = `${recipient.name}님 계좌로`;
  document.getElementById('amount-to-account').textContent = `${recipient.bank} ${recipient.account}`;

  setAmount(0);
  showScreen('amount');
}

// ---------- 3. 금액 입력 ----------
function setAmount(value) {
  state.amount = Math.max(0, value);
  document.getElementById('amount-display').innerHTML = `${state.amount.toLocaleString('ko-KR')}<span class="won-suffix">원</span>`;
  document.getElementById('amount-korean').textContent = amountInWords(state.amount) || ' ';

  const next = document.getElementById('btn-amount-next');
  next.disabled = state.amount <= 0 || state.amount > state.account.balance;
}

document.querySelectorAll('[data-add]').forEach((btn) => {
  btn.addEventListener('click', () => setAmount(state.amount + Number(btn.dataset.add)));
});
document.getElementById('btn-reset-amount').addEventListener('click', () => setAmount(state.account.balance));

document.getElementById('btn-amount-next').addEventListener('click', () => {
  document.getElementById('confirm-from-bank').textContent = state.account.bankName[0];
  document.getElementById('confirm-to-bank').textContent = state.selected.bank[0];
  document.getElementById('confirm-name').textContent = state.selected.name;
  document.getElementById('confirm-amount').textContent = won(state.amount);
  document.getElementById('confirm-amount-korean').textContent = amountInWords(state.amount) || ' ';
  document.getElementById('confirm-from-account').textContent = `${state.account.bankName} ${state.account.accountNumber}`;
  document.getElementById('confirm-to-display').textContent = state.selected.name;
  document.getElementById('fee-note').textContent = `${state.account.bankName}는 평생 수수료 무료!`;
  showScreen('confirm');
});

// ---------- 4. 이체 실행 (POST) ----------
document.getElementById('btn-send').addEventListener('click', async () => {
  const res = await fetch('/api/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toName: state.selected.name,
      toBank: state.selected.bank,
      toAccount: state.selected.account,
      amount: state.amount,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error);
    return;
  }

  state.account = data.account;
  document.getElementById('success-name').textContent = state.selected.name;
  document.getElementById('success-amount').textContent = won(-data.transaction.amount);
  document.getElementById('success-from-account').textContent = `${state.account.bankName} ${state.account.accountNumber}`;
  document.getElementById('success-to-account').textContent = `${state.selected.bank} ${state.selected.account}`;
  showScreen('success');
});

// ---------- 5. 거래내역조회 (GET) ----------
async function loadTransactions() {
  document.getElementById('history-product').textContent = state.account.productName;
  document.getElementById('history-account').textContent = state.account.accountNumber;

  const res = await fetch('/api/transactions');
  state.transactions = await res.json();

  if (state.transactions.length) {
    const oldest = state.transactions[state.transactions.length - 1].date;
    const newest = state.transactions[0].date;
    document.getElementById('date-range').textContent = `${oldest} ~ ${newest}`;
  }

  const list = document.getElementById('history-list');
  list.innerHTML = state.transactions
    .map((t, i) => {
      const isPositive = t.amount > 0;
      return `
        <li class="history-item" data-index="${i}">
          <div class="meta">
            <span class="name">${t.name}</span>
            <span class="datetime">${t.date} ${t.time}</span>
          </div>
          <div class="amounts">
            <span class="amount ${isPositive ? 'positive' : 'negative'}">${isPositive ? '+' : ''}${won(t.amount)}</span>
            <span class="balance-after">${won(t.balanceAfter)}</span>
          </div>
        </li>`;
    })
    .join('');

  list.querySelectorAll('.history-item').forEach((el) => {
    el.addEventListener('click', () => openDetail(state.transactions[Number(el.dataset.index)]));
  });
}

function openDetail(t) {
  document.getElementById('detail-name').textContent = t.name;
  document.getElementById('detail-amount').textContent = won(t.amount);
  document.getElementById('detail-datetime').textContent = `${t.date} ${t.time}`;
  document.getElementById('detail-method').textContent = t.method;
  document.getElementById('detail-category').textContent = t.category;
  document.getElementById('detail-bank').textContent = t.counterBank;
  document.getElementById('detail-counter-account').textContent = t.counterAccount;
  document.getElementById('detail-holder').textContent = t.counterHolder;
  document.getElementById('detail-sheet').classList.add('open');
}

// ---------- 초기 로드 ----------
loadAccount();
