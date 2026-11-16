# reference (해설지)

영상 속 은행 앱 UI(잔액 카드, 빠른메뉴, 이체내역, 이체 화면)를 참고해서 만든 **참고 구현**입니다.
실제 계좌/잔액/은행명은 쓰지 않고 가짜 데이터("데모뱅크")로 대체했습니다.

먼저 스스로 만들어보고, 막히는 부분만 찾아보는 용도로 쓰세요. 통째로 베끼면 연습 효과가 없습니다.

## 실행 방법

```bash
cd reference/backend
npm install
npm start
```

브라우저에서 `http://localhost:3000` 접속 (백엔드가 frontend 폴더를 그대로 서빙해서 포트 하나로 끝남 — CORS 신경 안 써도 됨).

## 구조

```
reference/
  backend/
    server.js      # Express API 서버 (계좌/이체내역/이체)
    package.json
  frontend/
    index.html     # 화면 3개 (대시보드/이체내역/이체)를 div로 두고 JS로 전환
    styles.css     # 모바일 우선 반응형
    app.js         # fetch로 API 호출 + 화면 그리기
```

## 핵심 개념 (막힐 때 이 부분만 찾아보기)

1. **화면 전환 (SPA 흉내)** — `app.js`의 `showScreen()`. 페이지 이동 없이 `.screen` 클래스를 토글해서
   화면을 바꾼다. 실제 앱도 페이지 전체를 리로드하지 않고 이런 식으로 동작한다.

2. **GET으로 데이터 읽기** — `loadAccount()`, `loadTransactions()`. `fetch(url)` →
   `res.json()` → DOM에 꽂아넣는 패턴이 반복된다. 리스트는 `.map().join('')`로 HTML 문자열을 만들어서
   `innerHTML`에 한 번에 넣는 게 각 항목마다 DOM을 직접 만드는 것보다 코드가 짧다.

3. **POST로 상태 바꾸기** — `transfer-form`의 submit 핸들러. `method: 'POST'` +
   `JSON.stringify(body)`로 서버에 보내고, 서버는 `req.body`를 받아 잔액을 깎고 거래내역을 추가한다.
   서버가 `400`을 보내면 (`!res.ok`) 에러 메시지만 보여주고 화면은 그대로 둔다 — 성공/실패를 구분해서
   처리하는 게 핵심.

4. **서버는 "진짜 DB" 없이 메모리 변수로** — `server.js`의 `let account`, `let transactions`.
   서버를 재시작하면 초기화된다. 진짜 DB 연결은 다음 단계 연습 주제로 남겨둠.

5. **모바일 우선 반응형** — `styles.css`에서 기본 스타일은 전부 모바일 기준으로 작성하고,
   `@media (min-width: 600px)`에서 넓은 화면일 때만 카드처럼 보이게 추가한다. 작은 화면부터 만들고
   큰 화면에서 "더해주는" 순서가 반대보다 훨씬 수월하다.

## 다음 연습 과제 (스스로 해보기)

- 이체 금액이 잔액보다 크면 버튼 자체를 비활성화하기
- 거래내역에 "검색/필터" 추가하기 (날짜, 이름으로)
- `localStorage`로 새로고침해도 마지막 화면 기억하기
- 진짜 DB(SQLite 등)로 바꿔서 서버 재시작해도 데이터 유지되게 하기
