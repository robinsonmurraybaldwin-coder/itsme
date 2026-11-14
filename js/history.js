import { getAccounts, getTransactions, deposit, setMemo } from "./api.js";
import {
  $, $$, won, toKoreanUnit, parseNumber, fmtDate, fmtShort, fmtFull, esc, query, bankOf,
  renderTabbar, paintIcons, handleSoon, toast, setLoading, errorBox, openSheet, trackVisit,
} from "./ui.js";

renderTabbar("home");
paintIcons();
handleSoon();
trackVisit("거래내역조회", "history.html");

const LABELS = {
  days: { 7: "1주일", 30: "1개월", 90: "3개월", 365: "1년" },
  type: { all: "전체", deposit: "입금", withdraw: "출금" },
  order: { desc: "최신순", asc: "과거순" },
};
const filter = { days: "30", type: "all", order: "desc" };

let accounts = [];
let list = []; // 지금 화면에 보이는 거래들 (상세 시트에서 찾아 씀)

const accountSel = $("#account");
const listEl = $("#list");
const currentAccount = () => accounts.find((a) => String(a.id) === accountSel.value);

// ---------- 목록 ----------
function txItem(tx) {
  const isIn = tx.type === "deposit";
  return `
    <li><button class="tx" data-id="${tx.id}">
      <span class="tx__date" style="grid-column:1/-1">${fmtShort(tx.created_at)}</span>
      <span class="tx__name">${esc(tx.counterparty)}</span>
      <span class="tx__amount ${isIn ? "plus" : ""}">${isIn ? "" : "-"}${won(tx.amount)}</span>
      <span class="tx__balance">${won(tx.balance_after)}</span>
    </button></li>`;
}

async function loadList() {
  const acc = currentAccount();
  $("#balance").textContent = won(acc.balance);
  $("#go-transfer").href = `transfer.html?from=${acc.id}`;
  $("#filter-label").textContent = `${LABELS.days[filter.days]} · ${LABELS.type[filter.type]} · ${LABELS.order[filter.order]}`;
  $("#period").textContent = `${fmtDate(Date.now() - filter.days * 86_400_000)} ~ ${fmtDate(Date.now())}`;

  listEl.innerHTML = '<li class="skeleton skeleton--row"></li>'.repeat(4);
  $("#count").textContent = "";
  try {
    list = await getTransactions(acc.id, { ...filter, days: Number(filter.days) });
    $("#count").textContent = `총 ${list.length}건`;
    listEl.innerHTML = list.length ? list.map(txItem).join("") : '<li class="empty">조회된 거래내역이 없어요.</li>';
  } catch (err) {
    listEl.replaceChildren(errorBox(`내역을 불러오지 못했어요. ${err.message}`, loadList));
  }
}

accountSel.addEventListener("change", loadList);

// ---------- 상세거래내역 시트 ----------
listEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".tx");
  if (btn) openDetail(list.find((t) => String(t.id) === btn.dataset.id));
});

function openDetail(tx) {
  const isIn = tx.type === "deposit";
  const again = !isIn && tx.counter_number
    ? `<a class="btn btn--line btn--sm" href="transfer.html?from=${tx.account_id}&bank=${encodeURIComponent(tx.counter_bank)}&number=${encodeURIComponent(tx.counter_number)}">다시이체</a>`
    : "";
  const rows = [
    ["거래일시", fmtFull(tx.created_at)],
    ["거래구분", tx.kind],
    ["거래내용", isIn ? "입금" : "출금"],
    ["상대은행", tx.counter_bank ? bankOf(tx.counter_bank).name : "-"],
    ["상대계좌", tx.counter_number ?? "-"],
    ["상대계좌 예금주명", tx.counter_name ?? "-"],
  ];
  const dlg = openSheet(
    `<p class="detail__name">${esc(tx.counterparty)}</p>
     <div class="detail__top">
       <span class="detail__amount ${isIn ? "plus" : ""}">${isIn ? "" : "-"}${won(tx.amount)}</span>${again}
     </div>
     <div class="rows">
       ${rows.map(([k, v]) => `<div class="row"><span class="row__label">${k}</span><span class="row__value">${esc(v)}</span></div>`).join("")}
       <form class="row" id="memo-form">
         <label class="row__label" for="memo">메모</label>
         <span class="memo"><input id="memo" maxlength="25" placeholder="최대 25자까지 입력" value="${esc(tx.memo ?? "")}">
         <button class="btn btn--line btn--sm">등록</button></span>
       </form>
     </div>`,
    { title: "상세거래내역" }
  );

  $("#memo-form", dlg).addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const saved = await setMemo(tx.id, $("#memo", dlg).value.trim());
      tx.memo = saved.memo;
      toast("메모를 저장했어요.");
    } catch (err) {
      toast(`메모 저장 실패: ${err.message}`);
    }
  });
}

// ---------- 조회 조건 시트 ----------
$("#open-filter").addEventListener("click", () => {
  const draft = { ...filter };
  const group = (key, title) => `
    <h4>${title}</h4>
    <div class="chips" data-group="${key}">
      ${Object.entries(LABELS[key]).map(([v, label]) => `<button type="button" class="chip" data-value="${v}">${label}</button>`).join("")}
    </div>`;
  const dlg = openSheet(
    `${group("days", "기간")}${group("type", "유형")}${group("order", "정렬")}
     <button type="button" class="btn btn--primary btn--block" id="apply">확인</button>`,
    { title: "조회 조건" }
  );
  const paint = () =>
    $$("[data-group]", dlg).forEach((g) =>
      $$(".chip", g).forEach((c) => c.classList.toggle("is-active", c.dataset.value === draft[g.dataset.group]))
    );
  paint();
  dlg.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (chip) {
      draft[chip.closest("[data-group]").dataset.group] = chip.dataset.value;
      return paint();
    }
    if (e.target.closest("#apply")) {
      Object.assign(filter, draft);
      dlg.close();
      loadList();
    }
  });
});

// ---------- 채우기 시트 ----------
$("#fill").addEventListener("click", () => {
  const dlg = openSheet(
    `<form method="dialog">
      <div class="input-box"><input id="fill-amount" inputmode="numeric" placeholder="금액 입력" aria-label="채울 금액"></div>
      <p class="field__hint" id="fill-hint"></p>
      <button class="btn btn--primary btn--block" value="ok">채우기</button>
    </form>`,
    { title: "얼마를 채울까요?" }
  );
  const input = $("#fill-amount", dlg);
  input.focus();
  input.addEventListener("input", () => {
    const n = parseNumber(input.value);
    input.value = n ? n.toLocaleString("ko-KR") : "";
    $("#fill-hint", dlg).textContent = toKoreanUnit(n);
  });
  dlg.addEventListener("close", async () => {
    const amount = parseNumber(input.value);
    if (dlg.returnValue !== "ok" || !amount) return;
    setLoading(true);
    try {
      await deposit(currentAccount().id, amount);
      accounts = await getAccounts();
      toast(`${won(amount)}을 채웠어요.`);
      loadList();
    } catch (err) {
      toast(err.message);
    } finally {
      setLoading(false);
    }
  });
});

// ---------- 시작 ----------
(async function init() {
  try {
    accounts = await getAccounts();
    accountSel.innerHTML = accounts.map((a) => `<option value="${a.id}">${esc(a.name)} ${esc(a.number)}</option>`).join("");
    if (accounts.some((a) => String(a.id) === query("account"))) accountSel.value = query("account");
    loadList();
  } catch (err) {
    listEl.replaceChildren(errorBox(`계좌를 불러오지 못했어요. ${err.message}`, () => location.reload()));
  }
})();
