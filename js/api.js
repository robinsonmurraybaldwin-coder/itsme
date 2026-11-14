// =========================================================
// API 계층: 화면 코드는 이 파일의 함수만 호출합니다.
// - Supabase REST API (js/config.js 설정이 있을 때)
// - 설정이 없으면 브라우저 localStorage 로 똑같이 흉내 냄
//
// 거래(transactions) 한 건의 모양
// { id, account_id, type: "deposit"|"withdraw", kind: "즉시이체" 등,
//   counterparty(내 통장 표기), amount, balance_after,
//   counter_bank, counter_number, counter_name(상대 예금주),
//   their_memo(받는 분 통장 표기), memo, created_at }
// =========================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const isRemote = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** fetch + 에러 처리 공통 함수 */
async function request(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `요청 실패 (${res.status})`);
  return data;
}

const DAY = 86_400_000;
const sinceISO = (days) => new Date(Date.now() - days * DAY).toISOString();

const db = isRemote ? createSupabaseDb() : createLocalDb();

export const getAccounts = () => db.getAccounts();
/** 계좌 하나의 거래내역 (type: all|deposit|withdraw, order: desc|asc) */
export const getTransactions = (accountId, opts) => db.getTransactions(accountId, opts);
/** 이체결과조회: 내가 보낸 이체만 (accountId 가 없으면 전체 계좌) */
export const getTransfers = (opts) => db.getTransfers(opts);
export const getTransaction = (id) => db.getTransaction(id);
export const findRecipient = (bank, number) => db.findRecipient(bank, number);
export const transfer = (payload) => db.transfer(payload);
export const deposit = (accountId, amount) => db.deposit(accountId, amount);
export const setMemo = (id, memo) => db.setMemo(id, memo);
export const getFavorites = () => db.getFavorites();
export const addFavorite = (r) => db.addFavorite(r);
export const removeFavorite = (bank, number) => db.removeFavorite(bank, number);

/** 최근 이체한 계좌: 받는 계좌별로 하나씩, 마지막 이체 날짜 포함 */
export async function getRecentRecipients() {
  const list = await getTransfers({ days: 365 });
  const map = new Map();
  for (const t of list) {
    const key = `${t.counter_bank}-${t.counter_number}`;
    if (!map.has(key)) map.set(key, { bank: t.counter_bank, number: t.counter_number, name: t.counter_name, lastAt: t.created_at });
  }
  return [...map.values()];
}

// ---------- Supabase 구현 ----------
function createSupabaseDb() {
  const base = `${SUPABASE_URL}/rest/v1`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
  const get = (path, params) => request(`${base}/${path}?${new URLSearchParams(params)}`, { headers });
  const rpc = (fn, body) => request(`${base}/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(body) });

  return {
    getAccounts: () => get("accounts", { select: "*", order: "id" }),

    getTransactions(accountId, { type = "all", days = 30, order = "desc" } = {}) {
      const params = { select: "*", account_id: `eq.${accountId}`, created_at: `gte.${sinceISO(days)}`, order: `created_at.${order}` };
      if (type !== "all") params.type = `eq.${type}`;
      return get("transactions", params);
    },

    getTransfers({ accountId, days = 30 } = {}) {
      const params = { select: "*", type: "eq.withdraw", kind: "eq.즉시이체", created_at: `gte.${sinceISO(days)}`, order: "created_at.desc" };
      if (accountId) params.account_id = `eq.${accountId}`;
      return get("transactions", params);
    },

    async getTransaction(id) {
      const [row] = await get("transactions", { select: "*", id: `eq.${id}` });
      return row ?? null;
    },

    async findRecipient(bank, number) {
      const [row] = await get("recipients", { bank: `eq.${bank}`, number: `eq.${number}`, limit: 1 });
      return row ?? null;
    },

    transfer: (p) =>
      rpc("transfer", {
        p_account_id: p.accountId,
        p_to_bank: p.bank,
        p_to_number: p.number,
        p_amount: p.amount,
        p_my_memo: p.myMemo,
        p_their_memo: p.theirMemo,
        p_memo: p.memo,
      }),

    deposit: (accountId, amount) => rpc("deposit", { p_account_id: accountId, p_amount: amount }),
    setMemo: (id, memo) => rpc("set_memo", { p_id: id, p_memo: memo }),

    getFavorites: () => get("favorites", { select: "*", order: "created_at" }),
    addFavorite: ({ bank, number, name }) =>
      request(`${base}/favorites`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({ bank, number, name }),
      }),
    removeFavorite: (bank, number) =>
      request(`${base}/favorites?${new URLSearchParams({ bank: `eq.${bank}`, number: `eq.${number}` })}`, {
        method: "DELETE",
        headers,
      }),
  };
}

// ---------- localStorage 구현 (Supabase 없이 연습할 때) ----------
// supabase/schema.sql 의 transfer / deposit 함수와 같은 규칙으로 동작합니다.
function createLocalDb() {
  const KEY = "practice-bank-db-v2";
  const OWNER = "김연습";
  const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms)); // 네트워크 지연 흉내

  const load = () => JSON.parse(localStorage.getItem(KEY) || "null") ?? seed();
  const save = (data) => localStorage.setItem(KEY, JSON.stringify(data));
  const byDate = (dir) => (a, b) => dir * (new Date(a.created_at) - new Date(b.created_at));

  function seed() {
    const ago = (days, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000).toISOString();
    const out = (account_id, bank, number, name, amount, balance_after, at) => ({
      account_id, type: "withdraw", kind: "즉시이체", counterparty: name, amount, balance_after,
      counter_bank: bank, counter_number: number, counter_name: name, their_memo: OWNER, memo: null, created_at: at,
    });
    const inc = (account_id, kind, counterparty, amount, balance_after, at) => ({
      account_id, type: "deposit", kind, counterparty, amount, balance_after,
      counter_bank: null, counter_number: null, counter_name: null, their_memo: null, memo: null, created_at: at,
    });
    const data = {
      accounts: [
        { id: 1, name: "보통예금(연습 통장)", number: "123-456789-01-011", balance: 3_250_000 },
        { id: 2, name: "자유적금(목돈 모으기)", number: "123-456789-02-022", balance: 1_200_000 },
      ],
      recipients: [
        { bank: "연습", number: "123-456789-01-011", name: OWNER },
        { bank: "연습", number: "123-456789-02-022", name: OWNER },
        { bank: "연습", number: "123-111111-01-011", name: "홍길동" },
        { bank: "가나", number: "98765432101", name: "김철수" },
        { bank: "다라", number: "3333012345678", name: "이영희" },
        { bank: "마바", number: "110123456789", name: "박민수" },
        { bank: "사아", number: "3020000123456", name: "최지우" },
      ],
      favorites: [],
      transactions: [
        inc(1, "타행이체", "용돈", 1_000_000, 1_000_000, ago(20)),
        out(1, "다라", "3333012345678", "이영희", 30_000, 970_000, ago(14, 3)),
        out(1, "가나", "98765432101", "김철수", 200_000, 770_000, ago(6)),
        out(1, "연습", "123-111111-01-011", "홍길동", 50_000, 720_000, ago(3, 5)),
        inc(1, "스마트뱅킹", "월급", 2_530_000, 3_250_000, ago(1, 2)),
        inc(2, "자동이체", "자동이체", 300_000, 1_200_000, ago(5)),
      ],
    };
    data.transactions.forEach((t, i) => (t.id = i + 1));
    save(data);
    return data;
  }

  function addTx(data, row) {
    const id = Math.max(0, ...data.transactions.map((t) => t.id)) + 1;
    const full = { counter_bank: null, counter_number: null, counter_name: null, their_memo: null, memo: null, ...row, id, created_at: new Date().toISOString() };
    data.transactions.push(full);
    return full;
  }

  return {
    async getAccounts() {
      await wait();
      return load().accounts;
    },

    async getTransactions(accountId, { type = "all", days = 30, order = "desc" } = {}) {
      await wait();
      const since = Date.now() - days * DAY;
      return load()
        .transactions.filter((t) => t.account_id === accountId && (type === "all" || t.type === type))
        .filter((t) => new Date(t.created_at) >= since)
        .sort(byDate(order === "desc" ? -1 : 1));
    },

    async getTransfers({ accountId, days = 30 } = {}) {
      await wait();
      const since = Date.now() - days * DAY;
      return load()
        .transactions.filter((t) => t.type === "withdraw" && t.kind === "즉시이체")
        .filter((t) => (!accountId || t.account_id === accountId) && new Date(t.created_at) >= since)
        .sort(byDate(-1));
    },

    async getTransaction(id) {
      await wait(200);
      return load().transactions.find((t) => t.id === Number(id)) ?? null;
    },

    async findRecipient(bank, number) {
      await wait(300);
      return load().recipients.find((r) => r.bank === bank && r.number === number) ?? null;
    },

    async transfer({ accountId, bank, number, amount, myMemo, theirMemo, memo }) {
      await wait(900);
      const data = load();
      const from = data.accounts.find((a) => a.id === accountId);
      const to = data.recipients.find((r) => r.bank === bank && r.number === number);
      if (!from) throw new Error("출금 계좌를 찾을 수 없어요.");
      if (!to) throw new Error("받는 계좌를 찾을 수 없어요.");
      if (!(amount > 0)) throw new Error("금액을 확인해 주세요.");
      if (bank === "연습" && number === from.number) throw new Error("같은 계좌로는 보낼 수 없어요.");
      if (from.balance < amount) throw new Error("잔액이 부족해요.");

      from.balance -= amount;
      const row = addTx(data, {
        account_id: from.id, type: "withdraw", kind: "즉시이체", counterparty: myMemo || to.name,
        amount, balance_after: from.balance, counter_bank: bank, counter_number: number,
        counter_name: to.name, their_memo: theirMemo || OWNER, memo: memo || null,
      });

      // 내 다른 계좌로 보냈으면 그 계좌에 입금
      const mine = bank === "연습" && data.accounts.find((a) => a.number === number);
      if (mine) {
        mine.balance += amount;
        addTx(data, {
          account_id: mine.id, type: "deposit", kind: "계좌이체", counterparty: theirMemo || OWNER,
          amount, balance_after: mine.balance, counter_bank: "연습", counter_number: from.number, counter_name: OWNER,
        });
      }
      save(data);
      return row;
    },

    async deposit(accountId, amount) {
      await wait();
      if (!(amount > 0 && amount <= 100_000_000)) throw new Error("1원 ~ 1억원까지 채울 수 있어요.");
      const data = load();
      const acc = data.accounts.find((a) => a.id === accountId);
      acc.balance += amount;
      const row = addTx(data, { account_id: accountId, type: "deposit", kind: "채우기", counterparty: "채우기", amount, balance_after: acc.balance });
      save(data);
      return row;
    },

    async setMemo(id, memo) {
      await wait(200);
      const data = load();
      const row = data.transactions.find((t) => t.id === id);
      row.memo = memo || null;
      save(data);
      return row;
    },

    async getFavorites() {
      await wait(200);
      return load().favorites;
    },

    async addFavorite({ bank, number, name }) {
      await wait(200);
      const data = load();
      if (!data.favorites.some((f) => f.bank === bank && f.number === number)) {
        data.favorites.push({ bank, number, name, created_at: new Date().toISOString() });
        save(data);
      }
    },

    async removeFavorite(bank, number) {
      await wait(200);
      const data = load();
      data.favorites = data.favorites.filter((f) => !(f.bank === bank && f.number === number));
      save(data);
    },
  };
}
