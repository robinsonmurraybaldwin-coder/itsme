// =========================================================
// 라우터: 주소의 # 뒤를 보고 화면을 바꿔 그립니다.
//   #/home  #/transfer?from=1  #/history?account=2  #/result?id=5  #/menu
// 페이지를 새로 불러오지 않고 #root 안의 내용만 바꾸기 때문에
// HTML 파일이 하나뿐이고, 화면 전환이 앱처럼 빠릅니다.
// =========================================================
import { $, $$, paintIcons, handleSoon, renderTabbar, setLoading, scrollTop, goBack } from "./ui.js";
import { mountHome } from "./home.js";
import { mountTransfer } from "./transfer.js";
import { mountHistory } from "./history.js";
import { mountResult } from "./result.js";
import { mountMenu } from "./menu.js";

const ROUTES = {
  home: { title: "연습뱅크", mount: mountHome, tab: "home" },
  transfer: { title: "이체", mount: mountTransfer },
  history: { title: "거래내역조회", mount: mountHistory, tab: "home" },
  result: { title: "이체결과조회", mount: mountResult },
  menu: { title: "전체메뉴", mount: mountMenu },
};

let cleanup = null; // 이전 화면이 남긴 정리 함수

function render() {
  // "#/result?id=5" → name: "result", params: id=5
  const [, name = "home", qs = ""] = location.hash.match(/^#\/(\w+)\??(.*)$/) ?? [];
  const key = name in ROUTES ? name : "home";
  const route = ROUTES[key];

  // 이전 화면 정리: 정리 함수 실행, 열린 시트·로딩 닫기
  cleanup?.();
  $$("dialog").forEach((d) => d.close());
  setLoading(false);

  // 새 화면 그리기: <template> 복사 → 아이콘 채우기 → 탭바 → 화면 코드 실행
  $("#root").replaceChildren($(`#tpl-${key}`).content.cloneNode(true));
  document.title = key === "home" ? route.title : `${route.title} - 연습뱅크`;
  paintIcons($("#root"));
  renderTabbar(route.tab);
  cleanup = route.mount(new URLSearchParams(qs)) ?? null;
  scrollTop();

  // 상태바 색을 화면 배경과 맞추기 (흰 화면 / 회색 화면)
  const plain = $("#root .app--plain");
  $(".statusbar").style.background = key === "menu" ? "var(--menu-top)" : plain ? "var(--surface)" : "";
}

// ---------- 상태바: 시계 ----------
function tick() {
  const now = new Date();
  $("#clock").textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
}
tick();
setInterval(tick, 10_000);

// ---------- 상태바: 배터리 (Battery API, 지원하는 브라우저만) ----------
function paintBattery(level) {
  const pct = Math.round(level * 100);
  $("#battery-text").textContent = `${pct}%`;
  $("#battery-level").style.width = `${pct}%`;
}
if (navigator.getBattery) {
  navigator.getBattery().then((b) => {
    paintBattery(b.level);
    b.addEventListener("levelchange", () => paintBattery(b.level));
  }).catch(() => paintBattery(1));
} else {
  paintBattery(1); // 사파리·파이어폭스는 배터리 정보를 주지 않음
}

// ---------- 안드로이드 버튼 ----------
$("#nav-recent").addEventListener("click", () => (location.hash = "#/menu"));
$("#nav-home").addEventListener("click", () => (location.hash = "#/home"));
$("#nav-back").addEventListener("click", goBack);

handleSoon();
window.addEventListener("hashchange", render);
render();
