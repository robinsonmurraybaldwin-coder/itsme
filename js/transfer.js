import { getAccounts, findRecipient, getRecentRecipients, transfer, getFavorites, addFavorite, removeFavorite } from "./api.js";
import {
  $, $$, icons, OWNER, BANKS, bankOf, bankBadge, won, toKoreanUnit, fmtDate, fmtFull, esc,
  goBack, scrollTop, setLoading, toast, openSheet, promptSheet, copyText, shareText, trackVisit,
} from "./ui.js";

/** 화면을 그릴 때마다 app.js 가 호출 (params: 주소의 ?뒤 값) */
export function mountTransfer(params) {
  trackVisit("이체", "#/transfer");

  // 화면 전체가 같이 쓰는 상태(state)
  const state = {
    accounts: [],
    from: null,       // 출금 계좌
    to: null,         // { bank, number, name }
    amount: 0,
    myMemo: "",       // 내 통장 표기
    theirMemo: OWNER, // 받는 분 통장 표기
    favorites: [],
    result: null,     // 이체 결과 거래
  };

  const keyOf = (r) => `${r.bank}-${r.number}`;
  const isFav = (r) => state.favorites.some((f) => keyOf(f) === keyOf(r));
  const shortBank = (code) => bankOf(code).name.replace(/은행|뱅크/, "");

  // =========================================================
  // 단계 이동
  // =========================================================
  const STEPS = ["step-to", "step-amount", "step-confirm", "step-done"];
  let current = "step-to";

  function go(stepId) {
    current = stepId;
    $$(".step").forEach((el) => el.classList.toggle("is-active", el.id === stepId));
    // 영상처럼: 첫 화면은 ☰, 중간 단계는 "취소", 완료 화면은 헤더 버튼 없음
    $("#header-menu").hidden = stepId !== "step-to";
    $("#header-cancel").hidden = !["step-amount", "step-confirm"].includes(stepId);
    $("#back").hidden = stepId === "step-done";
    scrollTop();
  }

  $("#back").addEventListener("click", () => {
    const i = STEPS.indexOf(current);
    if (i > 0) return go(STEPS[i - 1]);
    goBack();
  });
  $$("[data-goto]").forEach((btn) => btn.addEventListener("click", () => go(btn.dataset.goto)));

  // =========================================================
  // 1단계: 누구에게 보낼까요?
  // =========================================================
  const stepTo = $("#step-to");
  const numberInput = $("#number");
  const numberHint = $("#number-hint");

  function setHint(message = "", isError = false) {
    numberHint.textContent = message;
    numberHint.classList.toggle("is-error", isError);
  }

  /** 받는 사람 한 줄 (내 계좌 / 최근 이체 / 즐겨찾기 공통) */
  function personItem(r, right = "") {
    return `
      <li><button type="button" data-pick data-bank="${esc(r.bank)}" data-number="${esc(r.number)}">
        ${bankBadge(r.bank)}
        <span><span class="people__name">${esc(r.name)}</span><br>
        <span class="people__acct">${shortBank(r.bank)} ${esc(r.number)}</span></span>
        ${right}
      </button></li>`;
  }

  function renderMyAccounts() {
    const others = state.accounts.filter((a) => a.id !== state.from?.id);
    $("#my-accounts").innerHTML = others.length
      ? others.map((a) => personItem({ bank: "연습", number: a.number, name: a.name })).join("")
      : '<li class="people__acct">다른 계좌가 없어요.</li>';
  }

  async function loadRecent() {
    const list = await getRecentRecipients().catch(() => []);
    $("#recent-count").textContent = list.length;
    $("#recent").innerHTML = list.length
      ? list.map((r) => personItem(r, `<span class="people__date">최종이체 ${fmtDate(r.lastAt)}</span>`)).join("")
      : '<li class="people__acct">아직 이체한 계좌가 없어요.</li>';
  }

  function renderFavorites() {
    const star = `<span class="star is-on" data-unstar aria-label="즐겨찾기 해제">${icons.star}</span>`;
    $("#favorites").innerHTML = state.favorites.length
      ? state.favorites.map((r) => personItem(r, star)).join("")
      : '<li class="empty">즐겨찾기한 계좌가 없어요.<br>이체를 마친 뒤 ☆ 를 눌러 추가할 수 있어요.</li>';
  }

  // 계좌번호 / 즐겨찾기 탭
  $$(".segment button").forEach((tab) =>
    tab.addEventListener("click", () => {
      $$(".segment button").forEach((t) => {
        t.classList.toggle("is-active", t === tab);
        t.setAttribute("aria-selected", t === tab);
        $(`#${t.dataset.panel}`).hidden = t !== tab;
      });
    })
  );

  // 계좌번호를 8자리 이상 입력하면 아래 "확인" 버튼 표시
  numberInput.addEventListener("input", () => {
    numberInput.value = numberInput.value.replace(/[^\d-]/g, "");
    setHint();
    $("#to-cta").hidden = numberInput.value.replace(/-/g, "").length < 8;
  });

  $("#search-account").addEventListener("click", () => {
    numberInput.focus();
    toast("계좌번호를 입력하면 은행을 고를 수 있어요.");
  });

  // 확인 → 은행 고르기 시트 → 예금주 조회
  stepTo.addEventListener("submit", async (e) => {
    e.preventDefault();
    if ($("#to-cta").hidden) return;
    const bank = await chooseBank();
    if (bank) selectRecipient(bank, numberInput.value);
  });

  function chooseBank() {
    return new Promise((resolve) => {
      const dlg = openSheet(
        `<div class="bank-grid">${BANKS.map((b) => `<button type="button" data-bank="${b.code}">${bankBadge(b.code)}${b.name}</button>`).join("")}</div>`,
        { title: "은행을 선택해 주세요" }
      );
      let picked = null;
      dlg.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-bank]");
        if (!btn) return;
        picked = btn.dataset.bank;
        dlg.close();
      });
      dlg.addEventListener("close", () => resolve(picked));
    });
  }

  /** 목록에서 누르거나 은행을 고르면: 예금주 조회 후 금액 단계로 */
  async function selectRecipient(bank, number) {
    if (bank === "연습" && number === state.from.number) return setHint("출금 계좌와 같은 계좌예요.", true);
    setLoading(true);
    try {
      const found = await findRecipient(bank, number);
      if (!found) return setHint(`${bankOf(bank).name}에 없는 계좌예요. 은행과 계좌번호를 확인해 주세요.`, true);
      state.to = found;
      state.myMemo = found.name;
      enterAmountStep();
    } catch (err) {
      toast(err.message);
    } finally {
      setLoading(false);
    }
  }

  stepTo.addEventListener("click", async (e) => {
    // 즐겨찾기 탭의 별: 즐겨찾기 해제
    const unstar = e.target.closest("[data-unstar]");
    if (unstar) {
      const { bank, number } = unstar.closest("[data-pick]").dataset;
      await toggleFavorite({ bank, number });
      return renderFavorites();
    }
    const pick = e.target.closest("[data-pick]");
    if (pick) selectRecipient(pick.dataset.bank, pick.dataset.number);
  });

  // =========================================================
  // 2단계: 얼마를 보낼까요?
  // =========================================================
  const stepAmount = $("#step-amount");
  const amountBtn = $("#amount");
  const amountHint = $("#amount-hint");
  const amountNext = $("button.btn", stepAmount);

  function paintFrom() {
    $("#pick-from").innerHTML = `${bankBadge("연습")} 연습 ${esc(state.from.number)} ${icons.down}`;
    $("#from-balance").textContent = `출금가능금액 ${won(state.from.balance)}`;
  }

  function enterAmountStep() {
    paintFrom();
    $("#to-title").textContent = `${state.to.name}님 계좌로`;
    $("#to-line").innerHTML = `${bankBadge(state.to.bank)} ${shortBank(state.to.bank)} ${esc(state.to.number)}`;
    setAmount(0);
    go("step-amount");
  }

  function setAmount(n) {
    state.amount = n;
    amountBtn.textContent = n ? won(n) : "얼마를 보낼까요?";
    amountBtn.classList.toggle("is-empty", !n);

    const over = n > state.from.balance;
    amountHint.textContent = over ? `출금가능금액(${won(state.from.balance)})을 넘었어요.` : toKoreanUnit(n);
    amountHint.classList.toggle("is-error", over);
    amountNext.disabled = n <= 0 || over;
  }

  // 출금 계좌 바꾸기
  $("#pick-from").addEventListener("click", () => {
    const dlg = openSheet(
      `<div class="option-list" role="radiogroup">${state.accounts
        .map((a) => `<button type="button" role="radio" aria-checked="${a.id === state.from.id}" data-id="${a.id}">
          ${bankBadge("연습")}<span>${esc(a.name)}<br><small class="muted">${esc(a.number)} · ${won(a.balance)}</small></span></button>`)
        .join("")}</div>`,
      { title: "출금 계좌 선택" }
    );
    dlg.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-id]");
      if (!btn) return;
      const next = state.accounts.find((a) => String(a.id) === btn.dataset.id);
      if (next.number === state.to.number && state.to.bank === "연습") return toast("받는 계좌와 같은 계좌예요.");
      state.from = next;
      paintFrom();
      setAmount(state.amount);
      renderMyAccounts();
      dlg.close();
    });
  });

  // 금액 칸을 누르면 아래에서 키패드 시트가 올라옴
  amountBtn.addEventListener("click", openKeypad);

  function openKeypad() {
    amountBtn.classList.add("is-focus");
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0"];
    const dlg = openSheet(
      `<div class="chips chips--even">
        <button type="button" class="chip" data-add="10000">+1만</button>
        <button type="button" class="chip" data-add="50000">+5만</button>
        <button type="button" class="chip" data-add="100000">+10만</button>
        <button type="button" class="chip" data-add="1000000">+100만</button>
        <button type="button" class="chip" data-add="all">전액</button>
      </div>
      <div class="keypad">
        ${keys.map((k) => `<button type="button" data-key="${k}">${k}</button>`).join("")}
        <button type="button" data-key="back" aria-label="지우기">${icons.backspace}</button>
      </div>
      <button type="button" class="btn btn--primary btn--block" data-close>확인</button>`,
      { className: "keypad-sheet" }
    );

    const press = (key) => {
      const digits = String(state.amount || "");
      const next = key === "back" ? digits.slice(0, -1) : (digits + key).slice(0, 12);
      setAmount(Number(next) || 0);
    };

    dlg.addEventListener("click", (e) => {
      const add = e.target.closest("[data-add]")?.dataset.add;
      if (add) return setAmount(add === "all" ? state.from.balance : state.amount + Number(add));
      const key = e.target.closest("[data-key]")?.dataset.key;
      if (key) press(key);
    });
    // 컴퓨터에서는 키보드 숫자도 받기
    dlg.addEventListener("keydown", (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
      else if (e.key === "Enter") {
        e.preventDefault();
        dlg.close();
      }
    });
    dlg.addEventListener("close", () => amountBtn.classList.remove("is-focus"));
  }

  $("#guide").addEventListener("click", () =>
    openSheet(
      `<p>· 1회 이체한도: 출금가능금액 이내<br>· 이체 수수료: 0원 (평생 무료)<br>· 받는 분 계좌는 예금주 조회 후 이체돼요.<br>· 연습용 앱이라 실제 돈은 움직이지 않아요.</p>
       <button type="button" class="btn btn--primary btn--block" data-close>확인</button>`,
      { title: "이용안내" }
    )
  );

  $("#reserve").addEventListener("change", (e) => {
    if (e.target.checked) toast("연습 앱에서는 예약이체도 바로 처리돼요.");
  });

  stepAmount.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!amountNext.disabled) enterConfirmStep();
  });

  // =========================================================
  // 3단계: ○○님께 ○원을 보낼까요?
  // =========================================================
  function paintMemos() {
    $('[data-val="myMemo"]').textContent = state.myMemo;
    $('[data-val="theirMemo"]').textContent = state.theirMemo;
  }

  function enterConfirmStep() {
    const { to, from, amount } = state;
    $("#cf-badges").innerHTML = `${bankBadge("연습", "bank-badge--lg")}${icons.arrow}${bankBadge(to.bank, "bank-badge--lg")}`;
    $("#cf-name").textContent = `${to.name}님께`;
    $("#cf-account").textContent = `${shortBank(to.bank)} ${to.number}`;
    $("#cf-amount").textContent = `${won(amount)}을 보낼까요?`;
    $("#cf-amount-sub").textContent = toKoreanUnit(amount);
    $("#cf-from").innerHTML = `${bankBadge("연습")}<span>연습 ${esc(from.number)}<small>${esc(from.name)}</small></span>`;
    paintMemos();
    go("step-confirm");
  }

  // 통장 표기 바꾸기
  $$("[data-edit]").forEach((row) =>
    row.addEventListener("click", async () => {
      const key = row.dataset.edit;
      const title = key === "myMemo" ? "내 통장 표기" : "받는 분 통장 표기";
      const value = await promptSheet({ title, value: state[key], maxLength: 10 });
      if (value) {
        state[key] = value;
        paintMemos();
      }
    })
  );

  // 추가정보입력 / 자세히보기 펼치기 (aria-expanded 로 상태 표시)
  $$(".more-toggle").forEach((btn) =>
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", open);
      $(`#${btn.getAttribute("aria-controls")}`).hidden = !open;
    })
  );

  $("#step-confirm").addEventListener("submit", async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      state.result = await transfer({
        accountId: state.from.id,
        bank: state.to.bank,
        number: state.to.number,
        amount: state.amount,
        myMemo: state.myMemo,
        theirMemo: state.theirMemo,
        memo: $("#memo").value.trim(),
      });
      showDone();
    } catch (err) {
      showFail(err.message);
    } finally {
      setLoading(false);
    }
  });

  // =========================================================
  // 4단계: 완료
  // =========================================================
  function paintStar() {
    const on = isFav(state.to);
    $("#done-amount").innerHTML = `<span><b>${won(state.amount)}</b>을 보냈어요</span>
      <button type="button" class="star ${on ? "is-on" : ""}" id="star" aria-pressed="${on}" aria-label="즐겨찾기">${icons.star}</button>`;
  }

  const copyBtn = (n) => `<button type="button" class="copy" data-copy="${esc(n)}" aria-label="계좌번호 복사">${icons.copy}</button>`;
  const row = (label, value) => `<div class="row"><span class="row__label">${label}</span><span class="row__value">${value}</span></div>`;

  function showDone() {
    const { to, from, result } = state;
    $("#done-icon").className = "done__icon";
    $("#done-icon").innerHTML = icons.check;
    $("#done-name").textContent = `${to.name}님께`;
    $("#done-desc").textContent = "";
    paintStar();
    $("#done-tooltip").hidden = isFav(to);
    $("#done-more").hidden = false;

    $("#done-rows").innerHTML =
      row("출금계좌", `${bankBadge("연습")}<span>연습 ${esc(from.number)}<small>${esc(from.name)}</small></span>${copyBtn(from.number)}`) +
      row("입금계좌", `${bankBadge(to.bank)}<span>${shortBank(to.bank)} ${esc(to.number)}</span>${copyBtn(to.number)}`);
    $("#done-detail").innerHTML = [
      ["거래일시", fmtFull(result.created_at)],
      ["내 통장 표기", result.counterparty],
      ["받는 분 통장 표기", result.their_memo],
      ["수수료", "0원"],
      ["메모", result.memo || "-"],
    ].map(([k, v]) => row(k, esc(v))).join("");
    $("#done-history").href = `#/history?account=${from.id}`;
    $("#done-share").textContent = "공유";
    go("step-done");
  }

  function showFail(message) {
    $("#done-icon").className = "done__icon is-fail";
    $("#done-icon").textContent = "!";
    $("#done-name").textContent = "이체하지 못했어요";
    $("#done-amount").textContent = "";
    $("#done-desc").textContent = message;
    $("#done-tooltip").hidden = true;
    $("#done-rows").innerHTML = "";
    $("#done-detail").hidden = true;
    $("#done-more").hidden = true;
    $("#done-share").textContent = "다시 시도";
    state.result = null;
    go("step-done");
  }

  async function toggleFavorite(r) {
    const was = isFav(r);
    // 화면 먼저 바꾸고(낙관적 업데이트) 실패하면 되돌리기
    state.favorites = was ? state.favorites.filter((f) => keyOf(f) !== keyOf(r)) : [...state.favorites, r];
    try {
      await (was ? removeFavorite(r.bank, r.number) : addFavorite(r));
      toast(was ? "즐겨찾기에서 뺐어요." : "즐겨찾기에 추가했어요.");
    } catch (err) {
      state.favorites = await getFavorites().catch(() => state.favorites);
      toast(`즐겨찾기 저장 실패: ${err.message}`);
    }
  }

  $("#step-done").addEventListener("click", async (e) => {
    if (e.target.closest("#star")) {
      $("#done-tooltip").hidden = true;
      await toggleFavorite(state.to);
      paintStar();
      return renderFavorites();
    }
    if (e.target.closest("#done-tooltip button")) {
      $("#done-tooltip").hidden = true;
      return;
    }
    const copy = e.target.closest("[data-copy]");
    if (copy) copyText(copy.dataset.copy, "계좌번호를 복사했어요.");
  });

  $("#done-share").addEventListener("click", () => {
    if (!state.result) return go("step-confirm"); // 실패 화면의 "다시 시도"
    const { to, amount, result } = state;
    shareText("이체 완료", `[연습뱅크] ${to.name}님께 ${won(amount)}을 보냈어요.\n${bankOf(to.bank).name} ${to.number}\n${fmtFull(result.created_at)}`);
  });

  // =========================================================
  // 시작
  // =========================================================
  (async function init() {
    setLoading(true);
    try {
      const [accounts, favorites] = await Promise.all([getAccounts(), getFavorites().catch(() => [])]);
      state.accounts = accounts;
      state.favorites = favorites;
      state.from = accounts.find((a) => String(a.id) === params.get("from")) ?? accounts[0];
      renderMyAccounts();
      renderFavorites();
      await loadRecent();
    } catch (err) {
      toast(`계좌를 불러오지 못했어요. ${err.message}`);
    } finally {
      setLoading(false);
    }
    // 거래내역의 "다시이체"로 들어오면 받는 계좌를 바로 조회
    if (state.from && params.get("bank") && params.get("number")) selectRecipient(params.get("bank"), params.get("number"));
  })();
}
