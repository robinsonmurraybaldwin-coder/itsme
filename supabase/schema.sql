-- =========================================================
-- 연습뱅크 Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run
-- 모든 데이터는 가짜(연습용)입니다.
-- =========================================================

drop function if exists transfer, deposit;
drop table if exists transactions, recipients, accounts;

create table accounts (
  id       bigint generated always as identity primary key,
  name     text   not null,
  number   text   not null unique,
  balance  bigint not null default 0 check (balance >= 0)
);

-- 이체 받을 수 있는 가상 계좌 목록 (예금주 조회용)
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
  counterparty    text   not null,
  amount          bigint not null check (amount > 0),
  balance_after   bigint not null,
  counter_bank    text,
  counter_number  text,
  created_at      timestamptz not null default now()
);
create index on transactions (account_id, created_at desc);

-- ---------------------------------------------------------
-- 이체: 잔액 확인 → 차감 → 거래 기록을 한 번에(트랜잭션) 처리
-- 프론트에서 잔액을 직접 UPDATE 하지 못하게 하고 이 함수만 열어둡니다.
-- ---------------------------------------------------------
create function transfer(
  p_account_id bigint,
  p_to_bank    text,
  p_to_number  text,
  p_to_name    text,
  p_amount     bigint,
  p_my_memo    text default null
) returns transactions
language plpgsql security definer set search_path = public as $$
declare
  v_balance bigint;
  v_row     transactions;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception '금액을 확인해 주세요.';
  end if;

  if not exists (select 1 from recipients where bank = p_to_bank and number = p_to_number) then
    raise exception '받는 계좌를 찾을 수 없어요.';
  end if;

  -- for update: 동시에 두 번 이체해도 잔액이 꼬이지 않게 행을 잠금
  select balance into v_balance from accounts where id = p_account_id for update;
  if not found then raise exception '출금 계좌를 찾을 수 없어요.'; end if;
  if v_balance < p_amount then raise exception '잔액이 부족해요.'; end if;

  update accounts set balance = balance - p_amount where id = p_account_id
  returning balance into v_balance;

  insert into transactions (account_id, type, counterparty, amount, balance_after, counter_bank, counter_number)
  values (p_account_id, 'withdraw', coalesce(nullif(p_my_memo, ''), p_to_name), p_amount, v_balance, p_to_bank, p_to_number)
  returning * into v_row;

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

  update accounts set balance = balance + p_amount where id = p_account_id
  returning balance into v_balance;
  if not found then raise exception '계좌를 찾을 수 없어요.'; end if;

  insert into transactions (account_id, type, counterparty, amount, balance_after)
  values (p_account_id, 'deposit', '채우기', p_amount, v_balance)
  returning * into v_row;

  return v_row;
end $$;

-- ---------------------------------------------------------
-- RLS(행 단위 보안): 읽기만 허용, 쓰기는 위 함수로만
-- (로그인 없는 연습용이라 anon 이 전체 조회 가능 → 실제 서비스에선 auth.uid() 로 제한해야 함)
-- ---------------------------------------------------------
alter table accounts     enable row level security;
alter table recipients   enable row level security;
alter table transactions enable row level security;

create policy "read accounts"     on accounts     for select using (true);
create policy "read recipients"   on recipients   for select using (true);
create policy "read transactions" on transactions for select using (true);

revoke all on function transfer, deposit from public;
grant execute on function transfer, deposit to anon, authenticated;

-- ---------------------------------------------------------
-- 가짜 데이터
-- ---------------------------------------------------------
insert into accounts (name, number, balance) values
  ('보통예금(연습 통장)',   '123-456789-01-011', 3250000),
  ('자유적금(목돈 모으기)', '123-456789-02-022', 1200000);

insert into recipients (bank, number, name) values
  ('연습', '123-111111-01-011', '홍길동'),
  ('가나', '98765432101',       '김철수'),
  ('다라', '3333012345678',     '이영희');

insert into transactions (account_id, type, counterparty, amount, balance_after, counter_bank, counter_number, created_at) values
  (1, 'deposit',  '용돈',   1000000, 1000000, null,   null,                now() - interval '12 days'),
  (1, 'withdraw', '김철수',  200000,  800000, '가나', '98765432101',       now() - interval '6 days'),
  (1, 'withdraw', '홍길동',   50000,  750000, '연습', '123-111111-01-011', now() - interval '3 days 5 hours'),
  (1, 'deposit',  '월급',   2500000, 3250000, null,   null,                now() - interval '1 day 2 hours'),
  (2, 'deposit',  '자동이체', 300000, 1200000, null,  null,                now() - interval '5 days');
