// =========================================================
// 라우터: 주소의 # 뒤를 보고 화면을 바꿔 그립니다.
//   #/home  #/transfer?from=1  #/history?account=2  #/result?id=5  #/menu
// 페이지를 새로 불러오지 않고 #root 안의 내용만 바꾸기 때문에
// HTML 파일이 하나뿐이고, 화면 전환이 앱처럼 빠릅니다.
// =========================================================
import { $, $$, paintIcons, handleSoon, renderTabbar, setLoading } from "./ui.js";
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
  window.scrollTo(0, 0);
}

handleSoon();
window.addEventListener("hashchange", render);
render();
