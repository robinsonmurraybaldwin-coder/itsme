import { getAccounts } from "./api.js";
import { $, $$, icons, won, esc, renderTabbar, paintIcons, handleSoon, toast, copyText, errorBox } from "./ui.js";

renderTabbar("home");
paintIcons();
handleSoon();

const accountsEl = $("#accounts");
const dotsEl = $("#dots");

function accountCard(acc) {
  return `
    <article class="card account" data-id="${acc.id}">
      <div class="account__top">
        <div>
          <h3 class="account__name">${esc(acc.name)}</h3>
          <button class="account__number" data-copy="${esc(acc.number)}" aria-label="계좌번호 복사">${esc(acc.number)} ${icons.copy}</button>
        </div>
        <button class="icon-btn" data-soon="계좌 관리는 준비 중이에요." aria-label="계좌 더보기">${icons.more}</button>
      </div>
      <p class="account__balance">
        <span data-balance>${won(acc.balance)}</span>
        <button class="icon-btn" data-refresh aria-label="잔액 새로고침">${icons.refresh}</button>
      </p>
      <div class="account__actions">
        <a class="btn btn--primary" href="transfer.html?from=${acc.id}">이체</a>
        <button class="btn btn--primary" data-soon="ATM 출금은 준비 중이에요.">ATM출금</button>
      </div>
    </article>`;
}

async function loadAccounts() {
  accountsEl.innerHTML = '<div class="skeleton skeleton--card"></div>';
  try {
    const accounts = await getAccounts();
    accountsEl.innerHTML = accounts.map(accountCard).join("");
    dotsEl.innerHTML = accounts.map((_, i) => `<span class="${i ? "" : "is-active"}"></span>`).join("");
  } catch (err) {
    accountsEl.replaceChildren(errorBox(`계좌를 불러오지 못했어요. ${err.message}`, loadAccounts));
  }
}

// 카드 안 버튼은 이벤트 위임으로 처리
accountsEl.addEventListener("click", async (e) => {
  const copyBtn = e.target.closest("[data-copy]");
  if (copyBtn) return copyText(copyBtn.dataset.copy, "계좌번호를 복사했어요.");

  const refreshBtn = e.target.closest("[data-refresh]");
  if (!refreshBtn) return;
  const card = refreshBtn.closest(".account");
  refreshBtn.classList.add("is-spinning");
  try {
    const acc = (await getAccounts()).find((a) => String(a.id) === card.dataset.id);
    card.querySelector("[data-balance]").textContent = won(acc.balance);
  } catch {
    toast("잔액을 불러오지 못했어요.");
  } finally {
    refreshBtn.classList.remove("is-spinning");
  }
});

// 카드 넘기면 아래 점 위치 갱신
accountsEl.addEventListener("scroll", () => {
  const index = Math.round(accountsEl.scrollLeft / accountsEl.clientWidth);
  $$("span", dotsEl).forEach((dot, i) => dot.classList.toggle("is-active", i === index));
});

// 연습뱅크 / 다른금융 탭
$$("[data-tab]").forEach((btn) =>
  btn.addEventListener("click", () => {
    $$("[data-tab]").forEach((b) => {
      b.classList.toggle("is-active", b === btn);
      b.setAttribute("aria-selected", b === btn);
    });
    if (btn.dataset.tab === "mine") return loadAccounts();
    accountsEl.innerHTML = '<div class="card empty">연결된 다른 금융사 계좌가 없어요.</div>';
    dotsEl.innerHTML = "";
  })
);

loadAccounts();
