import { getAccounts, getTransactions, deposit } from "./api.js";
import { $, $$, icons, won, toKoreanUnit, parseNumber, fmtDate, fmtDateTime, fmtDay, esc, renderTabbar, toast, setLoading, errorBox } from "./ui.js";

renderTabbar("home");
$$("[data-icon]").forEach((el) => (el.innerHTML = icons[el.dataset.icon]));

const LABELS = {
  days: { 7: "1주일", 30: "1개월", 90: "3개월", 365: "1년" },
  type: { all: "전체", deposit: "입금", withdraw: "출금" },
  order: { desc: "최신순", asc: "과거순" },
};

const filter = { days: "30", type: "all", order: "desc" };
let accounts = [];

const accountSel = $("#account");
const listEl = $("#list");

const currentAccount = () => accounts.find((a) => String(a.id) === accountSel.value);

// ---------- 거래 목록 ----------
function txItem(tx) {
  const isDeposit = tx.type === "deposit";
  return `
    <li class="tx">
      <span class="tx__date">${fmtDateTime(tx.created_at).slice(6)}</span>
      <span class="tx__name">${esc(tx.counterparty)}</span>
      <span class="tx__amount ${isDeposit ? "plus" : "minus"}">${isDeposit ? "" : "-"}${won(tx.amount)}</span>
      <span class="tx__balance">${won(tx.balance_after)}</span>
    </li>`;
}

/** 같은 날짜끼리 묶어서 날짜 제목 + 거래들을 그림 */
function renderGrouped(list) {
  let lastDay = "";
  return list
    .map((tx) => {
      const day = fmtDay(tx.created_at);
      const head = day !== lastDay ? `<li class="tx-day">${day}</li>` : "";
      lastDay = day;
      return head + txItem(tx);
    })
    .join("");
}

async function loadList() {
  const acc = currentAccount();
  $("#balance").textContent = won(acc.balance);
  $("#go-transfer").href = `transfer.html?from=${acc.id}`;
  $("#filter-label").textContent = `${LABELS.days[filter.days]} · ${LABELS.type[filter.type]} · ${LABELS.order[filter.order]}`;

  const today = new Date();
  const start = new Date(today - filter.days * 86400000);
  $("#period").textContent = `${fmtDate(start)} ~ ${fmtDate(today)}`;

  listEl.innerHTML = '<li class="skeleton skeleton--row"></li>'.repeat(4);
  $("#count").textContent = "";
  try {
    const list = await getTransactions(acc.id, { ...filter, days: Number(filter.days) });
    $("#count").textContent = `총 ${list.length}건`;
    listEl.innerHTML = list.length ? renderGrouped(list) : '<li class="empty">조회된 거래내역이 없어요.</li>';
  } catch (err) {
    listEl.replaceChildren(errorBox(`내역을 불러오지 못했어요. ${err.message}`, loadList));
  }
}

async function refreshAccounts() {
  accounts = await getAccounts();
}

accountSel.addEventListener("change", loadList);

// ---------- 조회 조건 시트 ----------
const filterSheet = $("#filter-sheet");
let draft = {};

function paintChips() {
  $$("[data-group]", filterSheet).forEach((group) => {
    $$(".chip", group).forEach((chip) =>
      chip.classList.toggle("is-active", chip.dataset.value === draft[group.dataset.group])
    );
  });
}

$("#open-filter").addEventListener("click", () => {
  draft = { ...filter };
  paintChips();
  filterSheet.showModal();
});

filterSheet.addEventListener("click", (e) => {
  if (e.target === filterSheet) return filterSheet.close(); // 바깥 클릭 닫기
  const chip = e.target.closest(".chip");
  if (!chip) return;
  draft[chip.closest("[data-group]").dataset.group] = chip.dataset.value;
  paintChips();
});

filterSheet.addEventListener("close", () => {
  if (filterSheet.returnValue !== "apply") return;
  filterSheet.returnValue = "";
  Object.assign(filter, draft);
  loadList();
});

// ---------- 채우기 시트 ----------
const fillSheet = $("#fill-sheet");
const fillInput = $("#fill-amount");

$("#fill").addEventListener("click", () => {
  fillInput.value = "";
  $("#fill-hint").textContent = "";
  fillSheet.showModal();
});

fillSheet.addEventListener("click", (e) => e.target === fillSheet && fillSheet.close());

fillInput.addEventListener("input", () => {
  const n = parseNumber(fillInput.value);
  fillInput.value = n ? n.toLocaleString("ko-KR") : "";
  $("#fill-hint").textContent = toKoreanUnit(n);
});

fillSheet.addEventListener("close", async () => {
  const amount = parseNumber(fillInput.value);
  if (fillSheet.returnValue !== "apply" || !amount) return;
  fillSheet.returnValue = "";
  setLoading(true);
  try {
    await deposit(currentAccount().id, amount);
    await refreshAccounts();
    toast(`${won(amount)}을 채웠어요.`);
    loadList();
  } catch (err) {
    toast(err.message);
  } finally {
    setLoading(false);
  }
});

// ---------- 시작 ----------
(async function init() {
  try {
    await refreshAccounts();
    accountSel.innerHTML = accounts
      .map((a) => `<option value="${a.id}">${esc(a.name)} ${esc(a.number)}</option>`)
      .join("");
    const preset = new URLSearchParams(location.search).get("account");
    if (preset && accounts.some((a) => String(a.id) === preset)) accountSel.value = preset;
    loadList();
  } catch (err) {
    listEl.replaceChildren(errorBox(`계좌를 불러오지 못했어요. ${err.message}`, () => location.reload()));
  }
})();
