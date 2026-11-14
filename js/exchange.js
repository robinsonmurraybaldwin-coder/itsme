import { getExchangeRates, getCoinTickers } from "./api.js";
import { $, won, parseNumber, renderTabbar, errorBox } from "./ui.js";

renderTabbar("market");

const CURRENCIES = {
  USD: "🇺🇸 미국 달러",
  JPY: "🇯🇵 일본 엔",
  EUR: "🇪🇺 유로",
  CNY: "🇨🇳 중국 위안",
  GBP: "🇬🇧 영국 파운드",
};
const COINS = { "KRW-BTC": "비트코인", "KRW-ETH": "이더리움", "KRW-XRP": "리플", "KRW-SOL": "솔라나" };

const skeletons = (n) => '<div class="skeleton skeleton--row"></div>'.repeat(n);
let rates = {};

// ---------- 환율 ----------
async function loadRates() {
  const el = $("#rates");
  el.innerHTML = skeletons(3);
  try {
    const data = await getExchangeRates(Object.keys(CURRENCIES));
    rates = data.rates;
    $("#rate-date").textContent = `${data.date} 기준 · 유럽중앙은행 고시 환율`;
    el.innerHTML = Object.entries(CURRENCIES)
      .map(
        ([code, label]) => `
        <div class="ticker">
          <div><div class="ticker__name">${label}</div><div class="ticker__sub">1 ${code}</div></div>
          <div class="ticker__price">${won(rates[code], 2)}</div>
        </div>`
      )
      .join("");
    calcFromForeign();
  } catch (err) {
    el.replaceChildren(errorBox(`환율을 불러오지 못했어요. ${err.message}`, loadRates));
  }
}

// ---------- 계산기: 어느 칸에 입력해도 반대쪽이 계산됨 ----------
const currencySel = $("#currency");
const foreignInput = $("#foreign");
const krwInput = $("#krw");

currencySel.innerHTML = Object.entries(CURRENCIES)
  .map(([code, label]) => `<option value="${code}">${label}</option>`)
  .join("");

function calcFromForeign() {
  const rate = rates[currencySel.value];
  if (!rate) return;
  const krw = Number(foreignInput.value.replace(/[^\d.]/g, "")) * rate;
  krwInput.value = Math.round(krw).toLocaleString("ko-KR");
}

function calcFromKrw() {
  const rate = rates[currencySel.value];
  if (!rate) return;
  const n = parseNumber(krwInput.value);
  krwInput.value = n ? n.toLocaleString("ko-KR") : "";
  foreignInput.value = +(n / rate).toFixed(2);
}

currencySel.addEventListener("change", calcFromForeign);
foreignInput.addEventListener("input", calcFromForeign);
krwInput.addEventListener("input", calcFromKrw);

// ---------- 코인: 10초마다 다시 요청 (폴링) ----------
async function loadCoins() {
  const el = $("#coins");
  try {
    const list = await getCoinTickers(Object.keys(COINS));
    el.innerHTML = list
      .map((c) => {
        const pct = (c.changeRate * 100).toFixed(2);
        const cls = c.changeRate > 0 ? "up" : c.changeRate < 0 ? "down" : "";
        return `
          <div class="ticker">
            <div><div class="ticker__name">${COINS[c.market]}</div><div class="ticker__sub">${c.market.replace("KRW-", "")}</div></div>
            <div class="ticker__price">${won(c.price)}<div class="ticker__rate ${cls}">${c.changeRate > 0 ? "+" : ""}${pct}%</div></div>
          </div>`;
      })
      .join("");
    $("#coin-time").textContent = `${new Date().toLocaleTimeString("ko-KR")} 업데이트`;
  } catch (err) {
    el.replaceChildren(errorBox(`코인 시세를 불러오지 못했어요. ${err.message}`, loadCoins));
  }
}

let timer;
function startPolling() {
  clearInterval(timer);
  loadCoins();
  timer = setInterval(loadCoins, 10_000);
}
// 다른 탭을 보고 있을 땐 요청을 멈춰서 불필요한 호출을 줄임
document.addEventListener("visibilitychange", () =>
  document.hidden ? clearInterval(timer) : startPolling()
);

$("#coins").innerHTML = skeletons(4);
loadRates();
startPolling();
