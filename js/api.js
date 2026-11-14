// =========================================================
// API 계층: 화면 코드는 이 파일의 함수만 호출합니다.
// - 시세: 실제 공개 API (Frankfurter 환율, 업비트 코인)
// - 계좌/이체: Supabase REST API (설정이 없으면 localStorage 로 대체)
// =========================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const isRemote = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** fetch + 에러 처리 공통 함수 */
async function request(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Supabase 는 { message } 형태로 에러를 돌려줍니다.
    throw new Error(data?.message || `요청 실패 (${res.status})`);
  }
  return data;
}

// ---------------------------------------------------------
// 1. 공개 시세 API
// ---------------------------------------------------------

/**
 * 환율: 외화 1단위가 몇 원인지 돌려줍니다.
 * 예) { date: "2026-11-13", rates: { USD: 1385.2, JPY: 9.1, ... } }
 */
export async function getExchangeRates(codes = ["USD", "JPY", "EUR", "CNY"]) {
  const url = `https://api.frankfurter.dev/v1/latest?base=KRW&symbols=${codes.join(",")}`;
  const data = await request(url);
  // base=KRW 이면 "1원 = 0.00072달러" 형태라서 뒤집어 줍니다.
  const rates = Object.fromEntries(
    Object.entries(data.rates).map(([code, perWon]) => [code, 1 / perWon])
  );
  return { date: data.date, rates };
}

/** 업비트 코인 시세 */
export async function getCoinTickers(markets = ["KRW-BTC", "KRW-ETH", "KRW-XRP"]) {
  const data = await request(`https://api.upbit.com/v1/ticker?markets=${markets.join(",")}`);
  return data.map((t) => ({
    market: t.market,
    price: t.trade_price,
    changeRate: t.signed_change_rate, // 0.0123 = +1.23%
  }));
}

// ---------------------------------------------------------
// 2. 계좌 / 이체 API
// ---------------------------------------------------------

const db = isRemote ? createSupabaseDb() : createLocalDb();

export const getAccounts = () => db.getAccounts();
export const getTransactions = (accountId, opts) => db.getTransactions(accountId, opts);
export const findRecipient = (bank, number) => db.findRecipient(bank, number);
export const transfer = (payload) => db.transfer(payload);
export const deposit = (accountId, amount) => db.deposit(accountId, amount);

/** 최근 보낸 계좌: 출금 거래에서 중복을 뺀 최대 5개 */
export async function getRecentRecipients(accountId) {
  const list = await getTransactions(accountId, { type: "withdraw", days: 365 });
  const seen = new Map();
  for (const tx of list) {
    const key = `${tx.counter_bank}-${tx.counter_number}`;
    if (tx.counter_number && !seen.has(key)) {
      seen.set(key, { bank: tx.counter_bank, number: tx.counter_number, name: tx.counterparty });
    }
  }
  return [...seen.values()].slice(0, 5);
}

// ---------- Supabase 구현 ----------
function createSupabaseDb() {
  const base = `${SUPABASE_URL}/rest/v1`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
  const get = (path) => request(`${base}/${path}`, { headers });
  const rpc = (fn, body) =>
    request(`${base}/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(body) });

  return {
    getAccounts: () => get("accounts?select=*&order=id"),

    getTransactions(accountId, { type = "all", days = 30, order = "desc" } = {}) {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const params = new URLSearchParams({
        select: "*",
        account_id: `eq.${accountId}`,
        created_at: `gte.${since}`,
        order: `created_at.${order}`,
      });
      if (type !== "all") params.set("type", `eq.${type}`);
      return get(`transactions?${params}`);
    },

    async findRecipient(bank, number) {
      const params = new URLSearchParams({ bank: `eq.${bank}`, number: `eq.${number}`, limit: "1" });
      const [row] = await get(`recipients?${params}`);
      return row ?? null;
    },

    transfer: (p) =>
      rpc("transfer", {
        p_account_id: p.accountId,
        p_to_bank: p.bank,
        p_to_number: p.number,
        p_to_name: p.name,
        p_amount: p.amount,
        p_my_memo: p.myMemo,
      }),

    deposit: (accountId, amount) => rpc("deposit", { p_account_id: accountId, p_amount: amount }),
  };
}

// ---------- localStorage 구현 (Supabase 설정 전 연습용) ----------
function createLocalDb() {
  const KEY = "practice-bank-db";
  const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms)); // 네트워크 지연 흉내

  const load = () => JSON.parse(localStorage.getItem(KEY) || "null") ?? seed();
  const save = (data) => localStorage.setItem(KEY, JSON.stringify(data));

  function seed() {
    const now = Date.now();
    const ago = (d, h = 0) => new Date(now - d * 86400000 - h * 3600000).toISOString();
    const data = {
      accounts: [
        { id: 1, name: "보통예금(연습 통장)", number: "123-456789-01-011", balance: 3_250_000 },
        { id: 2, name: "자유적금(목돈 모으기)", number: "123-456789-02-022", balance: 1_200_000 },
      ],
      recipients: [
        { bank: "연습", number: "123-111111-01-011", name: "홍길동" },
        { bank: "가나", number: "98765432101", name: "김철수" },
        { bank: "다라", number: "3333012345678", name: "이영희" },
      ],
      transactions: [
        tx(1, "deposit", "월급", 2_500_000, 3_250_000, ago(1, 2)),
        tx(1, "withdraw", "홍길동", 50_000, 750_000, ago(3, 5), "연습", "123-111111-01-011"),
        tx(1, "withdraw", "김철수", 200_000, 800_000, ago(6), "가나", "98765432101"),
        tx(1, "deposit", "용돈", 1_000_000, 1_000_000, ago(12)),
        tx(2, "deposit", "자동이체", 300_000, 1_200_000, ago(5)),
      ],
    };
    data.transactions.forEach((t, i) => (t.id = i + 1));
    save(data);
    return data;
  }

  function tx(account_id, type, counterparty, amount, balance_after, created_at, counter_bank = null, counter_number = null) {
    return { account_id, type, counterparty, amount, balance_after, created_at, counter_bank, counter_number };
  }

  function addTx(data, t) {
    const id = Math.max(0, ...data.transactions.map((x) => x.id)) + 1;
    const row = { ...t, id, created_at: new Date().toISOString() };
    data.transactions.push(row);
    return row;
  }

  return {
    async getAccounts() {
      await wait();
      return load().accounts;
    },

    async getTransactions(accountId, { type = "all", days = 30, order = "desc" } = {}) {
      await wait();
      const since = Date.now() - days * 86400000;
      const dir = order === "desc" ? -1 : 1;
      return load()
        .transactions.filter((t) => t.account_id === accountId)
        .filter((t) => type === "all" || t.type === type)
        .filter((t) => new Date(t.created_at) >= since)
        .sort((a, b) => dir * (new Date(a.created_at) - new Date(b.created_at)));
    },

    async findRecipient(bank, number) {
      await wait(300);
      return load().recipients.find((r) => r.bank === bank && r.number === number) ?? null;
    },

    async transfer({ accountId, bank, number, name, amount, myMemo }) {
      await wait(900);
      const data = load();
      const acc = data.accounts.find((a) => a.id === accountId);
      if (!acc) throw new Error("출금 계좌를 찾을 수 없어요.");
      if (amount <= 0) throw new Error("금액을 확인해 주세요.");
      if (acc.balance < amount) throw new Error("잔액이 부족해요.");

      acc.balance -= amount;
      const row = addTx(data, tx(accountId, "withdraw", myMemo || name, amount, acc.balance, null, bank, number));
      save(data);
      return row;
    },

    async deposit(accountId, amount) {
      await wait();
      const data = load();
      const acc = data.accounts.find((a) => a.id === accountId);
      acc.balance += amount;
      const row = addTx(data, tx(accountId, "deposit", "채우기", amount, acc.balance, null));
      save(data);
      return row;
    },
  };
}
