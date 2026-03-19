# PostgreSQL 처음 세팅하기

Last updated: 2026-03-14

## 목적

이 문서는 LinguaCall의 인프라 첫 2단계를 설명한다.

1. PostgreSQL 데이터베이스를 만들고 `DATABASE_URL` 확보하기
2. DB 마이그레이션을 적용하고 초기 `plans` 데이터를 넣기

이 가이드는 PostgreSQL을 처음 써보는 사람 기준으로 작성했다.

## 권장 선택

첫 세팅은 `Supabase`를 쓰는 것을 권장한다.

이유:

- 바로 쓸 수 있는 hosted PostgreSQL을 제공한다.
- 이 저장소의 두 번째 migration은 `auth.jwt()`를 사용하므로 Supabase 스타일 SQL에 맞춰져 있다.
- 순수 PostgreSQL 서버를 직접 관리하는 것보다 초기 세팅이 단순하다.

만약 Supabase 대신 일반 PostgreSQL을 쓰면 첫 번째 migration은 문제없지만, 두 번째 RLS migration은 수정 없이 실행하면 실패할 가능성이 높다.

## 시작 전에 필요한 것

- 웹 브라우저
- 이 저장소 접근 권한
- 현재 워크스페이스의 터미널 접근 권한

## 1단계. Supabase 프로젝트 만들기

1. `https://supabase.com`으로 이동한다.
2. 가입하거나 로그인한다.
3. 새 프로젝트를 만든다.
4. 아래 항목을 선택한다.
   - organization
   - project name
   - 강력한 데이터베이스 비밀번호
   - 본인과 가까운 region
5. 프로젝트가 완전히 생성될 때까지 기다린다.

## 2단계. 데이터베이스 연결 문자열 복사하기

Supabase에서:

1. 프로젝트를 연다.
2. `Project Settings`로 이동한다.
3. `Database`로 이동한다.
4. connection string 섹션을 찾는다.
5. PostgreSQL URI를 복사한다.

대략 이런 형태다.

```env
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxx.supabase.co:5432/postgres
```

## 3단계. `DATABASE_URL`을 API env 파일에 넣기

아래 파일을 만들거나 수정한다.

- `apps/api/.env`

다음을 넣는다.

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxxxxxx.supabase.co:5432/postgres
```

보통 이후에는 같은 파일에 아래 값들도 같이 넣게 된다.

```env
PUBLIC_BASE_URL=http://localhost:5173
APP_BASE_URL=http://localhost:5173
API_BASE_URL=http://localhost:4000
```

웹 앱용 파일:

- `apps/web/.env`

```env
VITE_API_BASE_URL=http://localhost:4000
```

## 4단계. SQL Editor 열기

Supabase에서:

1. 프로젝트를 연다.
2. `SQL Editor`를 누른다.
3. 새 쿼리를 만든다.

이제 여기서 SQL을 실행하면 된다.

## 5단계. `pgcrypto` 활성화하기

먼저 아래 SQL을 실행한다.

```sql
create extension if not exists pgcrypto;
```

이유:

- migration에서 `gen_random_uuid()`를 사용한다.
- 이 함수는 `pgcrypto`에 의존한다.

## 6단계. Migration 1 실행하기

아래 파일의 전체 내용을 복사한다.

- `packages/db/migrations/20260313_phase1_init.sql`

그 다음 Supabase SQL Editor에서 실행한다.

이 단계에서 핵심 테이블이 생성된다.

- `users`
- `sessions`
- `messages`
- `evaluations`
- `reports`
- `plans`
- `subscriptions`
- `webhook_events`
- 관련 index들

## 7단계. Migration 2 실행하기

아래 파일의 전체 내용을 복사한다.

- `packages/db/migrations/20260313_phase1_rls.sql`

그 다음 Supabase SQL Editor에서 실행한다.

이 단계는 row-level security 정책을 켠다.

중요:

- 이 migration은 Supabase 스타일의 `auth.jwt()` 함수가 있다고 가정한다.
- Supabase가 아니라면 이 파일을 그대로 실행하면 안 된다.

## 8단계. `plans` 테이블에 초기 데이터 넣기

두 migration이 끝난 뒤 아래 SQL을 실행한다.

```sql
insert into plans (
  code,
  display_name,
  price_krw,
  included_minutes,
  trial_calls,
  max_session_minutes,
  entitlements,
  active
)
values
  ('free', 'Free', 0, 0, 3, 10, '[]'::jsonb, true),
  ('basic_mock', 'Basic Mock', 9900, 60, 0, 10, '[]'::jsonb, true),
  ('pro_mock', 'Pro Mock', 19900, 120, 0, 15, '[]'::jsonb, true)
on conflict (code)
do update set
  display_name = excluded.display_name,
  price_krw = excluded.price_krw,
  included_minutes = excluded.included_minutes,
  trial_calls = excluded.trial_calls,
  max_session_minutes = excluded.max_session_minutes,
  entitlements = excluded.entitlements,
  active = excluded.active,
  updated_at = now();
```

## 왜 이 플랜 코드가 중요한가

현재 기준으로:

- `free`는 사용자 기본 플랜이다.
- `basic_mock`, `pro_mock`는 로컬 또는 mock billing용으로 안전하다.

나중에 실제 Stripe로 전환할 때는:

- 유료 `plans.code` 값이 실제 Stripe `price_...` ID와 같아야 한다.
- 또는 payment adapter가 LinguaCall plan code를 Stripe price ID로 변환해줘야 한다.

처음 세팅 단계에서는 위 mock 코드 그대로 두면 된다.

실결제로 갈 때는 실제 Stripe price ID로 교체한다.

## 9단계. 테이블이 생성됐는지 확인하기

아래 SQL을 실행한다.

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

최소 아래 테이블이 보여야 한다.

- `credit_ledger`
- `evaluations`
- `messages`
- `plans`
- `reports`
- `sessions`
- `subscriptions`
- `users`
- `webhook_events`

## 10단계. `plans` 데이터가 제대로 들어갔는지 확인하기

아래 SQL을 실행한다.

```sql
select code, display_name, price_krw, included_minutes, trial_calls, max_session_minutes, active
from plans
order by price_krw asc, code asc;
```

기대 결과:

- `free` 행 1개
- `basic_mock` 행 1개
- `pro_mock` 행 1개

## Supabase가 아니라 일반 PostgreSQL을 쓰고 싶다면

가능은 하지만 차이가 2개 있다.

1. 아래 SQL은 여전히 필요하다.

```sql
create extension if not exists pgcrypto;
```

2. RLS migration은 현재 그대로는 이식성이 없다.

문제:

- `auth.jwt()`는 표준 PostgreSQL 함수가 아니다.

따라서 일반 PostgreSQL을 쓴다면:

- `20260313_phase1_init.sql`만 실행한다.
- `20260313_phase1_rls.sql`은 네 auth 모델에 맞게 정책을 바꾸기 전까지 실행하지 않는다.

현재 MVP 단계에서는 이것도 허용 가능하다. 앱 서버 레벨에서 이미 사용자 범위 제한을 적용하고 있기 때문이다.

## 최소 완료 기준

아래가 모두 참이면 1단계와 2단계는 끝난 것이다.

- `DATABASE_URL`이 `apps/api/.env`에 저장되어 있다.
- migration 1이 성공적으로 실행됐다.
- migration 2가 Supabase에서 성공적으로 실행됐거나, 일반 PostgreSQL에서 의도적으로 건너뛰었다.
- `plans`에 최소 `free`, `basic_mock`, `pro_mock`가 있다.
- API가 데이터베이스에 연결될 수 있다.

## 다음 단계

Postgres 세팅이 끝나면 다음 권장 순서는 아래다.

- 새 `DATABASE_URL`로 API를 실행한다.
- 서버가 정상 부팅되는지 확인한다.
- 그 다음 Twilio / Telegram / Stripe 값을 채운다.
