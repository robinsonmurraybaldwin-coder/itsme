// =========================================================
// 여러 화면에서 같이 쓰는 도구 모음
// =========================================================

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- 은행 목록 (전부 가상의 은행) ----------
export const BANKS = [
  { code: "연습", name: "연습뱅크", color: "#0ca678" },
  { code: "가나", name: "가나은행", color: "#3182f6" },
  { code: "다라", name: "다라은행", color: "#f59f00" },
  { code: "마바", name: "마바은행", color: "#7048e8" },
];
export const bankOf = (code) => BANKS.find((b) => b.code === code) ?? { code, name: code, color: "#868e96" };

export const bankBadge = (code) => {
  const b = bankOf(code);
  return `<span class="bank-badge" style="background:${b.color}">${b.code[0]}</span>`;
};

// ---------- 숫자 / 날짜 포맷 ----------
/** won(1234) → "1,234원", won(9.12, 2) → "9.12원" */
export const won = (n, digits = 0) => `${n.toLocaleString("ko-KR", { maximumFractionDigits: digits })}원`;

/** 1234567 → "123만 4,567원" (입력칸 아래 힌트용) */
export function toKoreanUnit(n) {
  if (!n) return "";
  const units = [
    [1_0000_0000, "억"],
    [1_0000, "만"],
  ];
  const parts = [];
  for (const [size, label] of units) {
    const q = Math.floor(n / size);
    if (q) parts.push(`${q.toLocaleString("ko-KR")}${label}`);
    n %= size;
  }
  if (n) parts.push(n.toLocaleString("ko-KR"));
  return `${parts.join(" ")}원`;
}

/** "1,234" 같은 문자열 → 1234 */
export const parseNumber = (str) => Number(String(str).replace(/[^\d]/g, "")) || 0;

const pad = (n) => String(n).padStart(2, "0");
export const fmtDate = (d) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
export const fmtDateTime = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 문자열을 HTML 에 넣기 전에 안전하게 변환 (XSS 방지) */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- 아이콘 (SVG 문자열) ----------
const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  bell: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  headset: svg('<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>'),
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  back: svg('<path d="m15 18-6-6 6-6"/>'),
  right: svg('<path d="m9 18 6-6-6-6"/>'),
  down: svg('<path d="m6 9 6 6 6-6"/>'),
  refresh: svg('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
  copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  wallet: svg('<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'),
  box: svg('<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>'),
  send: svg('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'),
  gift: svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>'),
  chart: svg('<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>'),
};

// ---------- 하단 탭바: 각 페이지에서 한 줄로 그려줌 ----------
const TABS = [
  { key: "home", label: "자산", icon: "wallet", href: "index.html" },
  { key: "product", label: "상품", icon: "box", href: "#" },
  { key: "transfer", label: "송금", icon: "send", href: "transfer.html", center: true },
  { key: "benefit", label: "혜택", icon: "gift", href: "#" },
  { key: "market", label: "시세", icon: "chart", href: "exchange.html" },
];

export function renderTabbar(active) {
  const nav = document.createElement("nav");
  nav.className = "tabbar";
  nav.setAttribute("aria-label", "주요 메뉴");
  nav.innerHTML = TABS.map(
    (t) => `
    <a href="${t.href}" class="tabbar__item ${t.center ? "tabbar__item--center" : ""} ${t.key === active ? "is-active" : ""}"
       ${t.key === active ? 'aria-current="page"' : ""} ${t.href === "#" ? 'data-soon="1"' : ""}>
      ${t.center ? `<span class="tabbar__circle">${icons[t.icon]}</span>` : icons[t.icon]}
      <span>${t.label}</span>
    </a>`
  ).join("");
  nav.addEventListener("click", (e) => {
    if (e.target.closest("[data-soon]")) {
      e.preventDefault();
      toast("준비 중인 메뉴예요.");
    }
  });
  document.body.append(nav);
}

// ---------- 토스트 / 로딩 ----------
let toastTimer;
export function toast(message) {
  let el = $(".toast");
  if (!el) {
    el = Object.assign(document.createElement("div"), { className: "toast", role: "status" });
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-show"), 2000);
}

export function setLoading(show) {
  let el = $(".loading");
  if (!el) {
    el = Object.assign(document.createElement("div"), { className: "loading" });
    el.innerHTML = `<div class="loading__dots" aria-label="처리 중">${"<span></span>".repeat(4)}</div>`;
    document.body.append(el);
  }
  el.classList.toggle("is-show", show);
}

/** 에러 박스 + 다시 시도 버튼 */
export function errorBox(message, onRetry) {
  const box = document.createElement("div");
  box.className = "error-box";
  box.innerHTML = `<p>${esc(message)}</p><button class="btn btn--line">다시 시도</button>`;
  box.querySelector("button").addEventListener("click", onRetry);
  return box;
}
