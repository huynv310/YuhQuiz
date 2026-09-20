// Migration phải chạy được trên DB cũ (thiếu cột/bảng) và chạy lại được nhiều lần
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import assert from 'node:assert/strict';
import fs from 'fs';

const mig = fs.readFileSync(new URL('../supabase/migrations/20260919_security_hardening.sql', import.meta.url), 'utf8');
const schema = fs.readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

async function freshDb() {
  const db = new PGlite({ extensions: { uuid_ossp, pg_trgm, unaccent } });
  await db.exec(`
  create schema auth; create schema storage;
  create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select 'authenticated' $$;
  create table storage.buckets(id text primary key,name text,public bool,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n,'/') $$;
  create publication supabase_realtime;
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public,auth,storage to anon,authenticated,service_role;
  alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
  alter default privileges in schema public grant all on functions to anon,authenticated,service_role;`);
  return db;
}
const U = '11111111-1111-1111-1111-111111111111', E1 = '22222222-2222-2222-2222-222222222222';

// 1) DB cũ: bảng chỉ có vài cột, exams chưa có author_id, đáp án nằm trong exams.answer_keys
{
  const db = await freshDb();
  await db.exec(`
  insert into auth.users(id,email) values('${U}','t@x.com');
  create table public.profiles(id uuid primary key, role varchar(20), full_name text, phone text, email text);
  insert into public.profiles values('${U}','teacher','GV Cu','0901','t@x.com');
  create table public.exams(id uuid primary key default gen_random_uuid(), created_by uuid, title text, subject text, config jsonb, answer_keys jsonb, is_active boolean default true);
  insert into public.exams(id,created_by,title,config,answer_keys) values('${E1}','${U}','De cu','{"sections":[{"question_count":1,"total_score":10}]}','{"part_1":{"1":"B"},"part_2":{},"part_3":{}}');
  create table public.classrooms(id uuid primary key default gen_random_uuid(), teacher_id uuid, name text, class_code varchar(8));
  create table public.submissions(id uuid primary key default gen_random_uuid(), exam_id uuid, student_name text, score numeric, answers jsonb);
  insert into public.submissions(exam_id,student_name,score,answers) values('${E1}','HS cu',10,'{"part_1":{"1":"B"}}');
  `);
  await db.exec(mig);                         // trước đây lỗi: column "author_id" does not exist
  await db.exec(mig);                         // idempotent
  const r = (await db.query(`select author_id from exams where id='${E1}'`)).rows[0];
  assert.equal(r.author_id, U, 'author_id được backfill từ created_by');
  const k = (await db.query(`select part_1_keys from exam_answer_keys where exam_id='${E1}'`)).rows[0];
  assert.deepEqual(k.part_1_keys, { 1: 'B' }, 'đáp án cũ được chuyển sang exam_answer_keys');
  const col = (await db.query(`select 1 from information_schema.columns where table_name='exams' and column_name='answer_keys'`)).rows;
  assert.equal(col.length, 0, 'cột answer_keys đã bị xóa khỏi exams');
  assert.equal((await db.query(`select count(*)::int c from submissions`)).rows[0].c, 1, 'dữ liệu bài nộp cũ còn nguyên');
  // hàm nộp bài hoạt động trên DB đã nâng cấp
  await db.exec(`reset role; select set_config('request.uid','${U}',false); set role authenticated;`);
  const ok = await db.query(`select public.start_attempt('${E1}','33333333-3333-3333-3333-333333333333','GV') s`);
  assert.ok(ok.rows[0].s, 'start_attempt chạy được trên DB cũ');
  console.log('✓ legacy #1: DB cũ thiếu cột → nâng cấp + chạy lại OK');
}

// 2) DB trống hoàn toàn (không chạy schema.sql): migration tự tạo mọi thứ
{
  const db = await freshDb();
  await db.exec(mig);
  const t = (await db.query(`select count(*)::int c from information_schema.tables where table_schema='public' and table_name in ('profiles','classrooms','class_memberships','exams','exam_assignments','question_bank','exam_answer_keys','submissions','student_mistakes')`)).rows[0].c;
  assert.equal(t, 9, 'tạo đủ 9 bảng');
  console.log('✓ legacy #2: DB trống → migration tự tạo đủ bảng');
}

// 3) Thứ tự chuẩn: schema.sql rồi migration, chạy 2 lần
{
  const db = await freshDb();
  await db.exec(schema); await db.exec(mig); await db.exec(mig);
  console.log('✓ legacy #3: schema.sql → migration ×2 OK');
}
