# 연습뱅크 (프론트엔드 연습용)

은행 앱 화면 흐름을 따라 만든 **연습용** 웹앱입니다. HTML/CSS/순수 JavaScript(ES Modules)만 사용합니다.
계좌, 이름, 은행은 모두 가짜이고 실제 금융 기관과는 관계없습니다.

## 화면

| 파일 | 내용 | 연습 포인트 |
|---|---|---|
| `index.html` | 홈: 계좌 카드, 맞춤메뉴, 환율 미리보기 | 반응형 레이아웃, 스와이프 카드, 이벤트 위임 |
| `transfer.html` | 이체: 받는 계좌 → 금액 → 확인 → 완료 | 폼 검증, 단계 전환, 상태 관리, POST 요청 |
| `history.html` | 거래내역: 기간·유형·정렬 필터, 채우기 | 쿼리 파라미터, `<dialog>` 바텀시트 |
| `exchange.html` | 환율 계산기, 코인 시세 | 실제 공개 API 호출, 폴링(10초마다 갱신) |

## 사용하는 API

- **Frankfurter** (`api.frankfurter.dev`): 환율, 키 필요 없음
- **업비트 시세** (`api.upbit.com/v1/ticker`): 코인 시세, 키 필요 없음
- **Supabase REST** (선택): 계좌, 이체, 거래내역 저장

모든 API 호출은 `js/api.js` 한 곳에 모여 있습니다.

## 실행

`fetch`와 ES Modules 때문에 **파일을 더블클릭해서 열면 동작하지 않습니다.** 로컬 서버로 여세요.

```bash
python3 -m http.server 8000
```

그다음 http://localhost:8000 을 엽니다. VS Code의 **Live Server** 확장을 써도 됩니다.

## 계좌 데이터: 로컬 모드 / Supabase 모드

- **로컬 모드 (기본)**: `js/config.js`가 비어 있으면 브라우저 `localStorage`에 저장합니다.
  처음 상태로 되돌리려면 개발자도구 콘솔에서 `localStorage.clear()`를 실행하세요.
- **Supabase 모드**
  1. supabase.com 에서 무료 프로젝트를 만듭니다.
  2. SQL Editor 에 `supabase/schema.sql` 내용을 붙여넣고 실행합니다.
  3. Project Settings → API 의 `URL`과 `anon public` 키를 `js/config.js`에 넣습니다.
  4. ⚠️ `service_role` 키는 절대 넣지 마세요.

이체는 프론트에서 잔액을 직접 바꾸지 않고, DB 함수(`transfer`, `deposit`)를 호출해서
잔액 확인 → 차감 → 기록을 한 번에 처리합니다.

## 테스트용 받는 계좌

| 은행 | 계좌번호 | 예금주 |
|---|---|---|
| 연습뱅크 | 123-111111-01-011 | 홍길동 |
| 가나은행 | 98765432101 | 김철수 |
| 다라은행 | 3333012345678 | 이영희 |

## 반응형 기준

- `~599px`: 휴대폰, 하단 탭바
- `600px~`: 메뉴 6칸, 계좌 카드 2장씩
- `768px~`: 가운데 정렬
- `1024px~`: 하단 탭바 → 왼쪽 사이드바, 홈 2단 레이아웃

## 직접 해보면 좋은 과제

1. 거래내역을 날짜별로 묶어서 보여주기 (`11월 14일` 제목 아래 목록)
2. 이체 금액 입력을 화면 숫자 키패드로 바꾸기
3. 받는 분 계좌를 즐겨찾기에 저장하기 (Supabase 테이블 추가)
4. 다크 모드 (`prefers-color-scheme`)
5. Supabase Auth로 로그인 붙이고 RLS를 `auth.uid()` 기준으로 바꾸기
