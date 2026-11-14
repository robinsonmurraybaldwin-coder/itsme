// =========================================================
// 여러 화면에서 같이 쓰는 도구 모음
// =========================================================

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** 로그인 기능이 없어서 사용자 이름은 고정 */
export const OWNER = "김연습";

// ---------- 은행 목록 (전부 가상의 은행) ----------
export const BANKS = [
  { code: "연습", name: "연습뱅크", color: "#0ca678" },
  { code: "가나", name: "가나은행", color: "#3182f6" },
  { code: "다라", name: "다라은행", color: "#f59f00" },
  { code: "마바", name: "마바은행", color: "#7048e8" },
  { code: "사아", name: "사아은행", color: "#e64980" },
  { code: "자차", name: "자차은행", color: "#868e96" },
];
export const bankOf = (code) => BANKS.find((b) => b.code === code) ?? { code, name: code ?? "-", color: "#868e96" };

export const bankBadge = (code, size = "") => {
  const b = bankOf(code);
  return `<span class="bank-badge ${size}" style="background:${b.color}">${esc(b.code[0])}</span>`;
};

// ---------- 숫자 / 날짜 / 문자열 ----------
/** won(1234) → "1,234원" */
export const won = (n) => `${Math.round(n).toLocaleString("ko-KR")}원`;

/** 1234567 → "123만 4,567원" (금액 아래 힌트) */
export function toKoreanUnit(n) {
  if (!n) return "";
  const parts = [];
  for (const [size, label] of [[1_0000_0000, "억"], [1_0000, "만"]]) {
    const q = Math.floor(n / size);
    if (q) parts.push(`${q.toLocaleString("ko-KR")}${label}`);
    n %= size;
  }
  if (n) parts.push(n.toLocaleString("ko-KR"));
  return `${parts.join(" ")}원`;
}

/** "1,234원" → 1234 */
export const parseNumber = (str) => Number(String(str).replace(/[^\d]/g, "")) || 0;

/** "123-456789-01-011" → "123-4567**-01-***" (이체확인증용 가리기) */
export const maskNumber = (n) => n.replace(/^(\d+-\d+)\d{2}(-\d+-)\d+$/, "$1**$2***");

const pad = (n) => String(n).padStart(2, "0");
const d = (v) => new Date(v);
export const fmtDate = (v) => `${d(v).getFullYear()}.${pad(d(v).getMonth() + 1)}.${pad(d(v).getDate())}`;
export const fmtTime = (v) => `${pad(d(v).getHours())}:${pad(d(v).getMinutes())}`;
/** "10.30 14:06" */
export const fmtShort = (v) => `${pad(d(v).getMonth() + 1)}.${pad(d(v).getDate())} ${fmtTime(v)}`;
/** "2026.10.30 14:06:29" */
export const fmtFull = (v) => `${fmtDate(v)} ${fmtTime(v)}:${pad(d(v).getSeconds())}`;

/** HTML 에 넣기 전에 특수문자 바꾸기 (XSS 방지) */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);


// ---------- 아이콘 ----------
const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  bell: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  headset: svg('<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>'),
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  back: svg('<path d="m15 18-6-6 6-6"/>'),
  right: svg('<path d="m9 18 6-6-6-6"/>'),
  down: svg('<path d="m6 9 6 6 6-6"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  refresh: svg('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
  copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  more: svg('<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>'),
  camera: svg('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z"/><circle cx="12" cy="13" r="3"/>'),
  contact: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7 20a5 5 0 0 1 10 0"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  share: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
  star: svg('<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/>'),
  home: svg('<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>'),
  moon: svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  backspace: svg('<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z"/><path d="m18 9-6 6M12 9l6 6"/>'),
  arrow: svg('<path d="m9 18 6-6-6-6"/>'),
  wallet: svg('<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'),
  box: svg('<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>'),
  send: svg('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'),
  gift: svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>'),
  chart: svg('<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>'),
};

/** <span data-icon="bell"> 같은 빈 태그에 아이콘 채우기 */
export const paintIcons = (root = document) => $$("[data-icon]", root).forEach((el) => (el.innerHTML = icons[el.dataset.icon]));

// ---------- 다크 모드 ----------
const isDark = () =>
  (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";

export function setupThemeToggle(btn) {
  const paint = () => {
    btn.innerHTML = isDark() ? icons.sun : icons.moon;
    btn.setAttribute("aria-label", isDark() ? "라이트 모드로 전환" : "다크 모드로 전환");
  };
  btn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    paint();
  });
  paint();
}

// ---------- 하단 탭바 ----------
const TABS = [
  { key: "home", label: "자산", icon: "wallet", href: "#/home" },
  { key: "product", label: "상품", icon: "box" },
  { key: "transfer", label: "송금", icon: "send", href: "#/transfer", center: true },
  { key: "benefit", label: "혜택", icon: "gift" },
  { key: "stock", label: "주식", icon: "chart" },
];

export function renderTabbar(active) {
  $(".tabbar")?.remove(); // 화면이 바뀔 때마다 다시 그림
  if (!active) return;
  const nav = document.createElement("nav");
  nav.className = "tabbar";
  nav.setAttribute("aria-label", "주요 메뉴");
  nav.innerHTML = TABS.map((t) => {
    const icon = t.center ? `<span class="tabbar__circle">${icons[t.icon]}</span>` : icons[t.icon];
    const cls = `tabbar__item ${t.key === active ? "is-active" : ""}`;
    return `<a class="${cls}" href="${t.href ?? "#"}" ${t.href ? "" : "data-soon"} ${t.key === active ? 'aria-current="page"' : ""}>
      ${icon}<span>${t.label}</span></a>`;
  }).join("");
  document.body.append(nav);
}

/** 뒤로가기: 앱 안에서 이동한 기록이 없으면 홈으로 */
export const goBack = () => (history.length > 1 ? history.back() : (location.hash = "#/home"));

/** data-soon 이 붙은 링크/버튼은 "준비 중" 토스트 (앱 시작 때 한 번 호출) */
export function handleSoon() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-soon]");
    if (!el) return;
    e.preventDefault();
    toast(el.dataset.soon || "준비 중인 메뉴예요.");
  });
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

export function errorBox(message, onRetry) {
  const box = document.createElement("div");
  box.className = "error-box";
  box.innerHTML = `<p>${esc(message)}</p><button class="btn btn--line">다시 시도</button>`;
  box.querySelector("button").addEventListener("click", onRetry);
  return box;
}

// ---------- 바텀시트 ----------
/**
 * 아래에서 올라오는 시트를 열고 <dialog> 를 돌려줍니다.
 * - 바깥(어두운 부분)이나 [data-close] 를 누르면 닫힘
 * - 닫히면 DOM 에서 자동으로 지워짐
 */
export function openSheet(html, { title = "", className = "" } = {}) {
  const dlg = document.createElement("dialog");
  dlg.className = `sheet ${className}`;
  dlg.innerHTML = `${title ? `<div class="sheet__head"><h3>${title}</h3>
    <button class="icon-btn" data-close aria-label="닫기">${icons.close}</button></div>` : ""}${html}`;
  document.body.append(dlg);
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest("[data-close]")) dlg.close();
  });
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
  return dlg;
}

/** 글자 하나 입력받는 시트 → 확인 누르면 값, 취소하면 null */
export function promptSheet({ title, value = "", maxLength = 10, placeholder = "" }) {
  return new Promise((resolve) => {
    const dlg = openSheet(
      `<form method="dialog">
        <div class="input-box"><input name="v" maxlength="${maxLength}" value="${esc(value)}" placeholder="${esc(placeholder)}"></div>
        <p class="field__hint">최대 ${maxLength}자</p>
        <button class="btn btn--primary btn--block" value="ok">확인</button>
      </form>`,
      { title }
    );
    const input = $("input", dlg);
    input.focus();
    input.select();
    dlg.addEventListener("close", () => resolve(dlg.returnValue === "ok" ? input.value.trim() : null));
  });
}

// ---------- 복사 / 공유 ----------
export async function copyText(text, message = "복사했어요.") {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    toast("복사에 실패했어요.");
  }
}

/** 휴대폰은 공유창, 지원 안 하면 클립보드 복사 */
export async function shareText(title, text) {
  if (navigator.share) {
    try {
      return await navigator.share({ title, text });
    } catch (err) {
      if (err.name === "AbortError") return; // 사용자가 공유창 닫음
    }
  }
  copyText(text, "내용을 복사했어요. 원하는 곳에 붙여넣으세요.");
}

// ---------- 최근 이용 메뉴 (전체메뉴 화면에서 사용) ----------
const RECENT_KEY = "recent-menus-v2";
export function trackVisit(label, href) {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").filter((m) => m.href !== href);
    localStorage.setItem(RECENT_KEY, JSON.stringify([{ label, href }, ...list].slice(0, 5)));
  } catch {}
}
export function recentVisits() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
