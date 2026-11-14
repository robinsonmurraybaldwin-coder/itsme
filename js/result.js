import { getAccounts, getTransfers, getTransaction } from "./api.js";
import {
  $, icons, OWNER, won, fmtDate, fmtShort, fmtFull, esc, maskNumber, bankOf,
  goBack, errorBox, openSheet, shareText, trackVisit, toast,
} from "./ui.js";

/** 화면을 그릴 때마다 app.js 가 호출 (params: 주소의 ?뒤 값) */
export function mountResult(params) {
  trackVisit("이체결과조회", "#/result");

  const DAYS = { 7: "1주일", 30: "1개월", 90: "3개월", 365: "1년" };
  let days = "30";
  let accounts = [];
  let transfers = [];

  const listEl = $("#list");
  const accountSel = $("#account");
  const searchInput = $("#search");

  // 주소가 #/result?id=5 이면 이체확인증, 아니면 목록
  // (주소로 화면을 나누면 브라우저 뒤로가기로 목록에 돌아올 수 있어요)
  const receiptId = params.get("id");
  $("#view-list").hidden = Boolean(receiptId);
  $("#view-receipt").hidden = !receiptId;

  $("#back").addEventListener("click", goBack);

  // ---------- 목록 ----------
  function item(t) {
    const b = bankOf(t.counter_bank);
    return `
      <li class="tx-item">
        <a class="tx" href="#/result?id=${t.id}">
          <span class="tx__date">${fmtShort(t.created_at)}</span><span class="tx__status">정상</span>
          <span><span class="tx__name">${esc(t.counter_name)}</span><br><span class="tx__acct">${esc(b.name)} ${esc(t.counter_number)}</span></span>
          <span class="tx__amount">${won(t.amount)}</span>
        </a>
        <button type="button" class="icon-btn tx__share" data-share="${t.id}" aria-label="${esc(t.counter_name)} 이체 공유">${icons.share}</button>
      </li>`;
  }

  function render() {
    const q = searchInput.value.trim();
    const shown = q ? transfers.filter((t) => t.counter_name.includes(q)) : transfers;
    listEl.innerHTML = shown.length ? shown.map(item).join("") : '<li class="empty">조회된 이체 내역이 없어요.</li>';
  }

  async function loadList() {
    $("#filter-label").textContent = `${DAYS[days]} · 즉시이체`;
    $("#period").textContent = `${fmtDate(Date.now() - days * 86_400_000)} ~ ${fmtDate(Date.now())}`;
    listEl.innerHTML = '<li class="skeleton skeleton--row"></li>'.repeat(4);
    try {
      transfers = await getTransfers({ accountId: Number(accountSel.value) || null, days: Number(days) });
      render();
    } catch (err) {
      listEl.replaceChildren(errorBox(`이체 내역을 불러오지 못했어요. ${err.message}`, loadList));
    }
  }

  accountSel.addEventListener("change", loadList);
  searchInput.addEventListener("input", render);

  $("#toggle-search").addEventListener("click", (e) => {
    const open = $("#search-bar").hidden;
    $("#search-bar").hidden = !open;
    e.currentTarget.setAttribute("aria-expanded", open);
    if (open) searchInput.focus();
    else {
      searchInput.value = "";
      render();
    }
  });

  $("#open-filter").addEventListener("click", () => {
    const dlg = openSheet(
      `<h4>기간</h4><div class="chips">${Object.entries(DAYS)
        .map(([v, label]) => `<button type="button" class="chip ${v === days ? "is-active" : ""}" data-value="${v}">${label}</button>`)
        .join("")}</div>
       <h4>이체 종류</h4><div class="chips"><button type="button" class="chip is-active">즉시이체</button></div>`,
      { title: "조회 조건" }
    );
    dlg.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-value]");
      if (!chip) return;
      days = chip.dataset.value;
      dlg.close();
      loadList();
    });
  });

  // 목록의 공유 버튼
  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-share]");
    if (btn) share(transfers.find((t) => String(t.id) === btn.dataset.share));
  });

  // ---------- 이체확인증 ----------
  let current = null;

  async function showReceipt(id) {
    const box = $("#receipt");
    box.innerHTML = '<div class="skeleton" style="height:420px;margin-top:20px"></div>';
    try {
      current = transfers.find((t) => String(t.id) === id) ?? (await getTransaction(id));
      if (!current) throw new Error("이체 내역을 찾을 수 없어요.");
      const from = accounts.find((a) => a.id === current.account_id);
      const rows = [
        ["거래구분", current.kind],
        ["거래일시", fmtFull(current.created_at)],
        ["출금계좌", from ? maskNumber(from.number) : "-"],
        ["내통장표시", current.counterparty],
        ["예금주", OWNER],
        ["입금은행", `${bankOf(current.counter_bank).name.replace(/은행|뱅크/, "")} ${current.counter_number}`],
        ["받는분", current.counter_name],
        ["수수료", "0원"],
        ["받는분통장표시", current.their_memo ?? OWNER],
        ["이체금액", won(current.amount)],
      ];
      box.innerHTML = `
        <h2>이체확인증</h2>
        <table><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>
        <p class="receipt__ok">위의 내용이 정상적으로 이체되었음을 확인합니다.</p>
        <p class="receipt__note">위 확인증은 고객 편의를 위해 제공되는 것으로 참고용으로만 사용하실 수 있습니다. (연습용 앱)</p>
        <p class="receipt__brand">연습뱅크</p>`;
    } catch (err) {
      box.replaceChildren(errorBox(err.message, () => (location.hash = "#/result")));
    }
  }

  function share(t) {
    if (!t) return toast("공유할 내역이 없어요.");
    shareText(
      "이체확인증",
      `[연습뱅크 이체확인증]\n받는분: ${t.counter_name}\n입금계좌: ${bankOf(t.counter_bank).name} ${t.counter_number}\n이체금액: ${won(t.amount)}\n거래일시: ${fmtFull(t.created_at)}`
    );
  }
  $("#share-receipt").addEventListener("click", () => share(current));

  // ---------- 시작 ----------
  (async function init() {
    try {
      accounts = await getAccounts();
      accountSel.innerHTML += accounts.map((a) => `<option value="${a.id}">${esc(a.name)} ${esc(a.number)}</option>`).join("");
    } catch {}
    receiptId ? showReceipt(receiptId) : loadList();
  })();
}
