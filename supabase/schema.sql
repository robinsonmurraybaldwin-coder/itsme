-- =========================================================
-- 연습뱅크 Supabase 스키마 (v2)
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run
-- 다시 실행하면 모든 데이터가 처음 상태로 돌아갑니다. (전부 가짜 데이터)
-- =========================================================

drop function if exists transfer, deposit, set_memo;
drop table if exists favorites, transactions, recipients, accounts;

create table accounts (
  id       bigint generated always as identity primary key,
  name     text   not null,
  number   text   not null unique,
  balance  bigint not null default 0 check (balance >= 0)
);

-- 이체 받을 수 있는 계좌 목록 (예금주 조회용). 내 계좌도 들어 있음
create table recipients (
  bank    text not null,
  number  text not null,
  name    text not null,
  primary key (bank, number)
);

create table transactions (
  id              bigint generated always as identity primary key,
  account_id      bigint not null references accounts(id) on delete cascade,
  type            text   not null check (type in ('deposit', 'withdraw')),
  kind            text   not null default '스마트뱅킹',   -- 거래구분: 즉시이체, 타행이체, 채우기 ...
  counterparty    text   not null,                        -- 내 통장 표기
  amount          bigint not null check (amount > 0),
  balance_after   bigint not null,
  counter_bank    text,
  counter_number  text,
  counter_name    text,                                   -- 상대 예금주
  their_memo      text,                                   -- 받는 분 통장 표기
  memo            text check (char_length(memo) <= 25),
  created_at      timestamptz not null default now()
);
create index on transactions (account_id, created_at desc);

create table favorites (
  bank        text not null,
  number      text not null,
  name        text not null,
  created_at  timestamptz not null default now(),
  primary key (bank, number),
  foreign key (bank, number) references recipients (bank, number) on delete cascade
);

-- ---------------------------------------------------------
-- 이체: 잔액 확인 → 차감 → 기록 (내 계좌로 보내면 입금까지)을 한 번에 처리
-- ---------------------------------------------------------
create function transfer(
  p_account_id bigint,
  p_to_bank    text,
  p_to_number  text,
  p_amount     bigint,
  p_my_memo    text default null,
  p_their_memo text default null,
  p_memo       text default null
) returns transactions
language plpgsql security definer set search_path = public as $$
declare
  v_owner   constant text := '김연습';
  v_from    accounts;
  v_to_id   bigint;
  v_name    text;
  v_balance bigint;
  v_row     transactions;
begin
  if p_amount is null or p_amount <= 0 then raise exception '금액을 확인해 주세요.'; end if;

  select name into v_name from recipients where bank = p_to_bank and number = p_to_number;
  if not found then raise exception '받는 계좌를 찾을 수 없어요.'; end if;

  -- for update: 동시에 두 번 이체해도 잔액이 꼬이지 않게 행을 잠금
  select * into v_from from accounts where id = p_account_id for update;
  if not found then raise exception '출금 계좌를 찾을 수 없어요.'; end if;
  if p_to_bank = '연습' and p_to_number = v_from.number then raise exception '같은 계좌로는 보낼 수 없어요.'; end if;
  if v_from.balance < p_amount then raise exception '잔액이 부족해요.'; end if;

  update accounts set balance = balance - p_amount where id = v_from.id returning balance into v_balance;

  insert into transactions (account_id, type, kind, counterparty, amount, balance_after,
                            counter_bank, counter_number, counter_name, their_memo, memo)
  values (v_from.id, 'withdraw', '즉시이체', coalesce(nullif(p_my_memo, ''), v_name), p_amount, v_balance,
          p_to_bank, p_to_number, v_name, coalesce(nullif(p_their_memo, ''), v_owner), nullif(p_memo, ''))
  returning * into v_row;

  -- 내 다른 계좌로 보냈으면 그 계좌에 입금 기록
  if p_to_bank = '연습' then
    update accounts set balance = balance + p_amount where number = p_to_number
    returning id, balance into v_to_id, v_balance;
    if v_to_id is not null then
      insert into transactions (account_id, type, kind, counterparty, amount, balance_after,
                                counter_bank, counter_number, counter_name)
      values (v_to_id, 'deposit', '계좌이체', coalesce(nullif(p_their_memo, ''), v_owner), p_amount, v_balance,
              '연습', v_from.number, v_owner);
    end if;
  end if;

  return v_row;
end $$;

create function deposit(p_account_id bigint, p_amount bigint)
returns transactions
language plpgsql security definer set search_path = public as $$
declare
  v_balance bigint;
  v_row     transactions;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then
    raise exception '1원 ~ 1억원까지 채울 수 있어요.';
  end if;

  update accounts set balance = balance + p_amount where id = p_account_id returning balance into v_balance;
  if not found then raise exception '계좌를 찾을 수 없어요.'; end if;

  insert into transactions (account_id, type, kind, counterparty, amount, balance_after)
  values (p_account_id, 'deposit', '채우기', '채우기', p_amount, v_balance)
  returning * into v_row;
  return v_row;
end $$;

-- 거래 메모만 바꿀 수 있게 하는 함수 (다른 칸은 못 바꿈)
create function set_memo(p_id bigint, p_memo text)
returns transactions
language plpgsql security definer set search_path = public as $$
declare v_row transactions;
begin
  if char_length(p_memo) > 25 then raise exception '메모는 25자까지 쓸 수 있어요.'; end if;
  update transactions set memo = nullif(p_memo, '') where id = p_id returning * into v_row;
  if not found then raise exception '거래를 찾을 수 없어요.'; end if;
  return v_row;
end $$;

-- ---------------------------------------------------------
-- RLS(행 단위 보안): 읽기만 허용, 돈이 움직이는 쓰기는 위 함수로만
-- (로그인 없는 연습용이라 누구나 조회 가능 → 실제 서비스는 auth.uid() 로 제한)
-- ---------------------------------------------------------
alter table accounts     enable row level security;
alter table recipients   enable row level security;
alter table transactions enable row level security;
alter table favorites    enable row level security;

create policy "read accounts"     on accounts     for select using (true);
create policy "read recipients"   on recipients   for select using (true);
create policy "read transactions" on transactions for select using (true);
create policy "read favorites"    on favorites    for select using (true);
create policy "add favorites"     on favorites    for insert with check (true);
create policy "remove favorites"  on favorites    for delete using (true);

revoke all on function transfer, deposit, set_memo from public;
grant execute on function transfer, deposit, set_memo to anon, authenticated;

-- ---------------------------------------------------------
-- 가짜 데이터
-- ---------------------------------------------------------
insert into accounts (name, number, balance) values
  ('보통예금(연습 통장)',   '123-456789-01-011', 3250000),
  ('자유적금(목돈 모으기)', '123-456789-02-022', 1200000);

insert into recipients (bank, number, name) values
  ('연습', '123-456789-01-011', '김연습'),
  ('연습', '123-456789-02-022', '김연습'),
  ('연습', '123-111111-01-011', '홍길동'),
  ('가나', '98765432101',       '김철수'),
  ('다라', '3333012345678',     '이영희'),
  ('마바', '110123456789',      '박민수'),
  ('사아', '3020000123456',     '최지우');

insert into transactions (account_id, type, kind, counterparty, amount, balance_after, counter_bank, counter_number, counter_name, their_memo, created_at) values
  (1, 'deposit',  '타행이체',   '용돈',   1000000, 1000000, null,   null,                null,     null,     now() - interval '20 days'),
  (1, 'withdraw', '즉시이체',   '이영희',   30000,  970000, '다라', '3333012345678',     '이영희', '김연습', now() - interval '14 days 3 hours'),
  (1, 'withdraw', '즉시이체',   '김철수',  200000,  770000, '가나', '98765432101',       '김철수', '김연습', now() - interval '6 days'),
  (1, 'withdraw', '즉시이체',   '홍길동',   50000,  720000, '연습', '123-111111-01-011', '홍길동', '김연습', now() - interval '3 days 5 hours'),
  (1, 'deposit',  '스마트뱅킹', '월급',   2530000, 3250000, null,   null,                null,     null,     now() - interval '1 day 2 hours'),
  (2, 'deposit',  '자동이체',   '자동이체', 300000, 1200000, null,  null,                null,     null,     now() - interval '5 days');
