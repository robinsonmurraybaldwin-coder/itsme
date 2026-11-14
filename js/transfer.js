import { getAccounts, findRecipient, getRecentRecipients, transfer } from "./api.js";
import { $, $$, icons, BANKS, bankOf, bankBadge, won, toKoreanUnit, parseNumber, esc, setLoading, toast } from "./ui.js";

// 화면 전체에서 공유하는 상태(state)
const state = {
  accounts: [],
  from: null, // 출금 계좌 객체
  to: null, // { bank, number, name }
  amount: 0,
};

const STEPS = ["step-to", "step-amount", "step-confirm", "step-done"];
let current = "step-to";

function go(stepId) {
  current = stepId;
  $$(".step").forEach((el) => el.classList.toggle("is-active", el.id === stepId));
  window.scrollTo(0, 0);
  if (stepId === "step-amount") $("#amount").focus();
}

// 뒤로가기: 이전 단계로, 첫 단계면 브라우저 뒤로
$("#back").innerHTML = icons.back;
$("#back").addEventListener("click", () => {
  const i = STEPS.indexOf(current);
  if (i > 0 && current !== "step-done") go(STEPS[i - 1]);
  else history.length > 1 ? history.back() : (location.href = "index.html");
});
$$("[data-goto]").forEach((btn) => btn.addEventListener("click", () => go(btn.dataset.goto)));

// =========================================================
// 1단계: 받는 계좌
// =========================================================
const stepTo = $("#step-to");
const fromSel = $("#from");
const bankSel = $("#bank");
const numberInput = $("#number");
const numberHint = $("#number-hint");
const toNextBtn = $("button.btn", stepTo);

bankSel.innerHTML = BANKS.map((b) => `<option value="${b.code}">${b.name}</option>`).join("");

function updateFrom() {
  state.from = state.accounts.find((a) => String(a.id) === fromSel.value);
  $("#from-balance").textContent = `출금가능금액 ${won(state.from.balance)}`;
  loadRecent();
}

async function loadRecent() {
  const ul = $("#recent");
  ul.innerHTML = '<li class="skeleton skeleton--row"></li>';
  const list = await getRecentRecipients(state.from.id).catch(() => []);
  ul.innerHTML = list.length
    ? list
        .map(
          (r) => `
        <li><button type="button" data-bank="${esc(r.bank)}" data-number="${esc(r.number)}">
          ${bankBadge(r.bank)}
          <span><span class="recent__name">${esc(r.name)}</span><br>
          <span class="recent__acct">${bankOf(r.bank).name} ${esc(r.number)}</span></span>
        </button></li>`
        )
        .join("")
    : '<li class="recent__acct">아직 보낸 계좌가 없어요.</li>';
}

// 최근 계좌 누르면 입력칸 채우고 바로 조회
$("#recent").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-number]");
  if (!btn) return;
  bankSel.value = btn.dataset.bank;
  numberInput.value = btn.dataset.number;
  stepTo.requestSubmit();
});

fromSel.addEventListener("change", updateFrom);

numberInput.addEventListener("input", () => {
  numberInput.value = numberInput.value.replace(/[^\d-]/g, "");
  numberHint.textContent = "";
  numberHint.classList.remove("is-error");
  toNextBtn.disabled = numberInput.value.replace(/-/g, "").length < 8;
});

stepTo.addEventListener("submit", async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    const found = await findRecipient(bankSel.value, numberInput.value);
    if (!found) {
      numberHint.textContent = "계좌를 찾을 수 없어요. 은행과 계좌번호를 확인해 주세요.";
      numberHint.classList.add("is-error");
      return;
    }
    state.to = found;
    fillAmountStep();
    go("step-amount");
  } catch (err) {
    toast(err.message);
  } finally {
    setLoading(false);
  }
});

// =========================================================
// 2단계: 금액
// =========================================================
const stepAmount = $("#step-amount");
const amountInput = $("#amount");
const amountHint = $("#amount-hint");
const amountNextBtn = $("button.btn", stepAmount);

function fillAmountStep() {
  $("#sum-from").innerHTML = `${bankBadge("연습")} 연습 ${esc(state.from.number)}`;
  $("#sum-from-balance").textContent = `출금가능금액 ${won(state.from.balance)}`;
  $("#sum-to-name").textContent = `${state.to.name}님 계좌로`;
  $("#sum-to").innerHTML = `${bankBadge(state.to.bank)} ${bankOf(state.to.bank).name} ${esc(state.to.number)}`;
  setAmount(0);
}

function setAmount(n) {
  state.amount = n;
  amountInput.value = n ? n.toLocaleString("ko-KR") : "";

  const over = n > state.from.balance;
  amountHint.textContent = over ? `출금가능금액(${won(state.from.balance)})을 넘었어요.` : toKoreanUnit(n);
  amountHint.classList.toggle("is-error", over);
  amountNextBtn.disabled = n <= 0 || over;
}

// 입력하면서 자동으로 콤마 찍기
amountInput.addEventListener("input", () => setAmount(parseNumber(amountInput.value)));

$(".chips", stepAmount).addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]")?.dataset.add;
  if (!add) return;
  setAmount(add === "all" ? state.from.balance : state.amount + Number(add));
});

$("#reserve").addEventListener("change", (e) => {
  if (e.target.checked) toast("연습 앱에서는 예약이체도 바로 처리돼요.");
});

stepAmount.addEventListener("submit", (e) => {
  e.preventDefault();
  if (amountNextBtn.disabled) return;
  $("#cf-badges").innerHTML = bankBadge("연습") + bankBadge(state.to.bank);
  $("#cf-name").textContent = `${state.to.name}님께`;
  $("#cf-account").textContent = `${bankOf(state.to.bank).name} ${state.to.number}`;
  $("#cf-amount").textContent = `${won(state.amount)}을 보낼까요?`;
  $("#cf-from").innerHTML = `연습 ${esc(state.from.number)}<small>${esc(state.from.name)}</small>`;
  $("#my-memo").value = state.to.name;
  go("step-confirm");
});

// =========================================================
// 3단계: 확인 → 실제 이체 API 호출
// =========================================================
$("#step-confirm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    await transfer({
      accountId: state.from.id,
      bank: state.to.bank,
      number: state.to.number,
      name: state.to.name,
      amount: state.amount,
      myMemo: $("#my-memo").value.trim(),
    });
    showDone(true, `${state.to.name}님께 ${won(state.amount)}을 보냈어요.`);
  } catch (err) {
    showDone(false, err.message);
  } finally {
    setLoading(false);
  }
});

function showDone(ok, message) {
  $("#done-icon").innerHTML = ok ? icons.check : "!";
  $("#done-icon").style.background = ok ? "" : "var(--minus)";
  $("#done-title").textContent = ok ? "이체 완료" : "이체 실패";
  $("#done-desc").textContent = message;
  $("#done-history").href = `history.html?account=${state.from.id}`;
  go("step-done");
}

// =========================================================
// 시작: 계좌 목록 불러오기
// =========================================================
(async function init() {
  setLoading(true);
  try {
    state.accounts = await getAccounts();
    fromSel.innerHTML = state.accounts
      .map((a) => `<option value="${a.id}">${esc(a.name)} ${esc(a.number)}</option>`)
      .join("");
    // 홈에서 "이체" 누르고 왔으면 그 계좌를 미리 선택
    const preset = new URLSearchParams(location.search).get("from");
    if (preset && state.accounts.some((a) => String(a.id) === preset)) fromSel.value = preset;
    updateFrom();
  } catch (err) {
    toast(`계좌를 불러오지 못했어요. ${err.message}`);
  } finally {
    setLoading(false);
  }
})();
