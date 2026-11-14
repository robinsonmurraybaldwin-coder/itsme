import { getAccounts, getExchangeRates } from "./api.js";
import { $, $$, icons, won, esc, renderTabbar, toast, errorBox, setupThemeToggle } from "./ui.js";

renderTabbar("home");
setupThemeToggle($("#theme"));
$$("[data-icon]").forEach((el) => (el.innerHTML = icons[el.dataset.icon]));
$$("[data-soon]").forEach((el) =>
  el.addEventListener("click", (e) => {
    e.preventDefault();
    toast("준비 중인 메뉴예요.");
  })
);

const accountsEl = $("#accounts");
const dotsEl = $("#dots");

// ---------- 계좌 카드 ----------
function accountCard(acc) {
  return `
    <article class="card account" data-id="${acc.id}">
      <h3 class="account__name">${esc(acc.name)}</h3>
      <button class="account__number" data-copy="${esc(acc.number)}" aria-label="계좌번호 복사">
        ${esc(acc.number)} ${icons.copy}
      </button>
      <p class="account__balance">
        <span data-balance>${won(acc.balance)}</span>
        <button class="icon-btn" data-refresh aria-label="잔액 새로고침">${icons.refresh}</button>
      </p>
      <div class="account__actions">
        <a class="btn btn--soft" href="transfer.html?from=${acc.id}">이체</a>
        <a class="btn btn--soft" href="history.html?account=${acc.id}">내역</a>
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

// 카드 안의 버튼들은 이벤트 위임으로 한 번에 처리
accountsEl.addEventListener("click", async (e) => {
  const copyBtn = e.target.closest("[data-copy]");
  if (copyBtn) {
    try {
      await navigator.clipboard.writeText(copyBtn.dataset.copy);
      toast("계좌번호를 복사했어요.");
    } catch {
      toast("복사에 실패했어요.");
    }
    return;
  }

  const refreshBtn = e.target.closest("[data-refresh]");
  if (refreshBtn) {
    const card = refreshBtn.closest(".account");
    refreshBtn.classList.add("is-spinning");
    try {
      const accounts = await getAccounts();
      const acc = accounts.find((a) => String(a.id) === card.dataset.id);
      card.querySelector("[data-balance]").textContent = won(acc.balance);
    } catch {
      toast("잔액을 불러오지 못했어요.");
    } finally {
      refreshBtn.classList.remove("is-spinning");
    }
  }
});

// 스와이프하면 아래 점(dots) 위치 갱신
accountsEl.addEventListener("scroll", () => {
  const index = Math.round(accountsEl.scrollLeft / accountsEl.clientWidth);
  $$("span", dotsEl).forEach((d, i) => d.classList.toggle("is-active", i === index));
});

// ---------- 내 계좌 / 다른금융 탭 ----------
$$(".seg__btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    $$(".seg__btn").forEach((b) => {
      b.classList.toggle("is-active", b === btn);
      b.setAttribute("aria-selected", b === btn);
    });
    if (btn.dataset.tab === "mine") return loadAccounts();
    accountsEl.innerHTML = '<div class="card empty">연결된 다른 금융사 계좌가 없어요.</div>';
    dotsEl.innerHTML = "";
  })
);

// ---------- 환율 미리보기 ----------
const FLAGS = { USD: "🇺🇸 미국 달러", JPY: "🇯🇵 일본 엔 (100엔)", EUR: "🇪🇺 유로" };

async function loadRates() {
  const el = $("#rates");
  try {
    const { rates, date } = await getExchangeRates(Object.keys(FLAGS));
    el.innerHTML = Object.entries(FLAGS)
      .map(([code, label]) => {
        const value = code === "JPY" ? rates[code] * 100 : rates[code];
        return `
          <div class="ticker">
            <div><div class="ticker__name">${label}</div><div class="ticker__sub">${date} 기준</div></div>
            <div class="ticker__price">${won(value)}</div>
          </div>`;
      })
      .join("");
  } catch (err) {
    el.replaceChildren(errorBox(`환율을 불러오지 못했어요. ${err.message}`, loadRates));
  }
}

loadAccounts();
loadRates();
