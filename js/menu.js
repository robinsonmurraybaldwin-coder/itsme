import { $, $$, OWNER, esc, goBack, setupThemeToggle, recentVisits } from "./ui.js";

/** 화면을 그릴 때마다 app.js 가 호출. 돌려준 함수는 화면을 떠날 때 실행됨 */
export function mountMenu() {
  setupThemeToggle($("#theme"));
  $("#user").textContent = `${OWNER}님`;

  $("#close").addEventListener("click", goBack);

  // 메뉴 데이터: href 가 없으면 "준비 중"
  const MENUS = [
    { id: "inquiry", tab: "조회", icon: "🔍", items: [
      { label: "전체계좌조회", href: "#/home" },
      { label: "거래내역조회", href: "#/history" },
      { label: "이체결과조회", href: "#/result" },
      { label: "해지계좌조회" },
      { label: "계좌통합관리(어카운트인포)" },
    ] },
    { id: "transfer", tab: "이체/출금", icon: "💸", items: [
      { label: "이체", href: "#/transfer" },
      { label: "예약이체" },
      { label: "자동이체" },
      { label: "ATM출금" },
    ] },
    { id: "saving", tab: "예적금", icon: "🐷", items: [{ label: "예금 가입" }, { label: "적금 가입" }, { label: "만기 해지" }] },
    { id: "loan", tab: "대출", icon: "🏦", items: [{ label: "대출 상품" }, { label: "대출 조회" }, { label: "대출 상환" }] },
  ];

  const link = ({ label, href }, text = esc(label)) =>
    href ? `<a href="${href}">${text}</a>` : `<button class="menu-link" data-soon>${text}</button>`;

  function recentSection() {
    const list = recentVisits();
    return `
      <section class="menu-section" id="recent">
        <h2><span>🕘</span>최근 이용 메뉴</h2>
        ${list.length ? list.map((m) => link(m)).join("") : '<p class="muted" style="padding:8px 0">아직 이용한 메뉴가 없어요.</p>'}
      </section>`;
  }

  const tabs = [{ id: "recent", tab: "최근" }, ...MENUS];
  $("#tabs").innerHTML = tabs.map((t, i) => `<button class="chip ${i ? "" : "is-active"}" data-target="${t.id}">${t.tab}</button>`).join("");

  function renderAll() {
    $("#sections").innerHTML =
      recentSection() +
      MENUS.map((m) => `
        <section class="menu-section" id="${m.id}">
          <h2><span>${m.icon}</span>${m.tab}</h2>
          ${m.items.map((it) => link(it)).join("")}
        </section>`).join("");
    // 새로 그린 섹션들을 다시 관찰
    observer.disconnect();
    $$(".menu-section[id]").forEach((sec) => observer.observe(sec));
  }

  // 검색: 이름에 검색어가 들어간 메뉴만, 검색어는 강조
  function renderSearch(q) {
    const hits = MENUS.flatMap((m) => m.items).filter((it) => it.label.includes(q));
    const mark = (label) => esc(label).replaceAll(esc(q), `<mark>${esc(q)}</mark>`);
    $("#sections").innerHTML = `
      <section class="menu-section">
        <h2>검색 결과 ${hits.length}건</h2>
        ${hits.length ? hits.map((it) => link(it, mark(it.label))).join("") : '<p class="muted" style="padding:8px 0">찾는 메뉴가 없어요.</p>'}
      </section>`;
  }

  $("#search").addEventListener("input", (e) => {
    const q = e.target.value.trim();
    $("#tabs").hidden = Boolean(q);
    q ? renderSearch(q) : renderAll();
  });

  // 탭 누르면 해당 섹션으로 스크롤
  $("#tabs").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-target]");
    if (chip) $(`#${chip.dataset.target}`).scrollIntoView({ behavior: "smooth" });
  });

  // 스크롤 위치에 맞춰 탭 강조 (IntersectionObserver: 화면에 보이는 섹션 감지)
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.find((en) => en.isIntersecting);
      if (!visible) return;
      $$("#tabs .chip").forEach((c) => c.classList.toggle("is-active", c.dataset.target === visible.target.id));
    },
    { root: $(".scroller"), rootMargin: "-70px 0px -70% 0px" }
  );

  renderAll();
  return () => observer.disconnect(); // 화면을 떠날 때 관찰 중지
}
