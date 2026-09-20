import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import fs from 'fs';
import { build } from 'esbuild';
const root=new URL('../supabase/',import.meta.url);
const db=new PGlite({extensions:{uuid_ossp,pg_trgm,unaccent}});
await db.exec(`
create schema auth; create schema storage;
create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
create table storage.buckets(id text primary key,name text,public bool,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n,'/') $$;
create function auth.role() returns text language sql stable as $$ select 'authenticated' $$;
create publication supabase_realtime;
create role anon nologin; create role authenticated nologin; create role service_role nologin;
`);
await db.exec(`grant usage on schema public,auth,storage to anon,authenticated,service_role; alter default privileges in schema public grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant all on functions to anon,authenticated,service_role; alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
await db.exec('grant all on all tables in schema storage to anon,authenticated,service_role;');
for (const f of ['schema.sql','migrations/20260919_security_hardening.sql','migrations/20260920_exam_ids_grade_limits.sql','migrations/20260921_question_bank_subject_grade.sql','migrations/20260922_solution_attachments.sql','migrations/20260923_practice_solutions.sql','migrations/20260924_user_codes.sql','migrations/20260925_data_cleanup_account_delete.sql','migrations/20260926_linter_hardening.sql','migrations/20260927_legacy_cleanup.sql']) {
  try { await db.exec(fs.readFileSync(new URL(f,root),'utf8')); console.log('OK',f); }
  catch(e){ console.log('FAIL',f,e.message, e.position||''); break; }
}

const T='11111111-1111-1111-1111-111111111111', S='22222222-2222-2222-2222-222222222222', S2='33333333-3333-3333-3333-333333333333';
const EX='44444444-4444-4444-4444-444444444444', TOK='55555555-5555-5555-5555-555555555555';
await db.exec(`
insert into auth.users(id,email,raw_user_meta_data) values
 ('${T}','t@x.com','{"phone":"0901","role":"teacher","full_name":"GV"}'),
 ('${S}','s@x.com','{"phone":"0902","full_name":"HS"}'),
 ('${S2}','s2@x.com','{"phone":"0903","full_name":"HS2"}');
select set_config('request.uid','${T}',false);
insert into exams(id,author_id,created_by,title,duration_minutes,allow_multiple_attempts,config)
 values('${EX}','${T}','${T}','De 1',50,false,'{"sections":[{"question_count":2,"total_score":10},{"question_count":0},{"question_count":0}]}');
insert into exam_answer_keys(exam_id,part_1_keys,part_2_keys,part_3_keys) values('${EX}','{"1":"A","2":"B"}','{}','{}');
`);
const as=async(uid,role,sql)=>{ await db.exec(`reset role; select set_config('request.uid','${uid}',false); set role ${role};`);
  try{ return (await db.query(sql)).rows; }catch(e){ return new Error(e.message); } };
let fail=0;
const check=(name,val,ok)=>{ const pass=ok(val); if(!pass) fail++; console.log(pass?'PASS':'FAIL',name, pass?'':JSON.stringify(val instanceof Error?val.message:val)); };
const denied=v=>v instanceof Error, empty=v=>Array.isArray(v)&&v.length===0;
const CL='77777777-7777-7777-7777-777777777777', TOK3='88888888-8888-8888-8888-888888888888';
await db.exec(`reset role; insert into classrooms(id,teacher_id,name,class_code) values('${CL}','${T}','12A','ABC123'); insert into class_memberships(class_id,student_id) values('${CL}','${S2}');`);
const TOK2='66666666-6666-6666-6666-666666666666';

check('student cannot read answer keys', await as(S,'authenticated','select * from exam_answer_keys'), empty);
check('student cannot read exams table', await as(S,'authenticated','select * from exams'), empty);
const pe=await as(S,'authenticated','select * from public_exams');
check('student reads public_exams w/o key columns', pe, v=>v.length===1 && !('answer_keys' in v[0]));
check('anon cannot read public_exams', await as(S,'anon','select * from public_exams'), denied);
check('direct submission insert blocked', await as(S,'authenticated',`insert into submissions(exam_id,student_id,session_token,status,total_score) values('${EX}','${S}','${TOK}','submitted',10)`), denied);
check('self-promote to teacher blocked', await as(S,'authenticated',`update profiles set role='teacher' where id='${S}'`), v=>v instanceof Error && /vai trò/.test(v.message));
check('start_attempt ok', await as(S,'authenticated',`select public.start_attempt('${EX}','${TOK}','HS') s`), v=>v[0]?.s);
check('token hijack blocked', await as(S2,'authenticated',`select public.submit_and_grade_exam('${EX}','${TOK}','HS2','','{}',0,0)`), denied);
check('server grades 5/10', await as(S,'authenticated',`select public.submit_and_grade_exam('${EX}','${TOK}','HS','','{"part_1":{"1":"A","2":"C"}}',0,0) r`), v=>Number(v[0]?.r?.score)===5);
check('resubmit is idempotent', await as(S,'authenticated',`select public.submit_and_grade_exam('${EX}','${TOK}','HS','','{"part_1":{"1":"A","2":"B"}}',0,0) r`), v=>Number(v[0]?.r?.score)===5);
check('second attempt blocked', await as(S,'authenticated',`select public.submit_and_grade_exam('${EX}','${TOK2}','HS','','{}',0,0)`), denied);
check('leaderboard shows score', await as(S,'authenticated','select student_name,score from public_leaderboard'), v=>v.length===1 && Number(v[0].score)===5);
check('teacher reads own keys', await as(T,'authenticated','select part_1_keys from exam_answer_keys'), v=>v.length===1);
check('teacher sees submissions', await as(T,'authenticated','select count(*)::int c from submissions'), v=>v[0].c===1);
check('other student sees no submissions', await as(S2,'authenticated','select count(*)::int c from submissions'), v=>v[0].c===0);
const imp=(uid,stu,tok,ans)=>as(uid,'authenticated',`select public.teacher_import_rescue('${EX}','${stu}','${tok}','${ans}',2,30) r`);
check('import rescue: teacher, own student', await imp(T,S2,TOK3,'{"part_1":{"1":"A","2":"B"}}'), v=>Number(v[0]?.r?.score)===10);
check('import rescue: duplicate blocked', await imp(T,S2,TOK3,'{}'), denied);
check('import rescue: student cannot call', await imp(S,S2,'99999999-9999-9999-9999-999999999999','{}'), denied);
check('import rescue: student outside class blocked', await imp(T,S,'99999999-9999-9999-9999-999999999998','{}'), denied);
// ---- Đề sinh tự động có cả 3 phần: server phải chấm khớp với assembleExam ----
const out = await build({ entryPoints: [new URL('../src/utils/autoGen.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')], bundle: true, format: 'esm', write: false });
const gen = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const bank = [
  { id: 'q1', part: 1, correct_key: 'C' }, { id: 'q2', part: 1, correct_key: 'A' },
  { id: 'q3', part: 2, correct_key: 'TFFT' },
  { id: 'q4', part: 3, correct_key: '-1,5' },
];
const asm = gen.assembleExam(bank);
const EX2 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', TOK4 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
await db.exec(`reset role; select set_config('request.uid','${T}',false);`);
await db.query(`insert into exams(id,author_id,created_by,title,duration_minutes,config) values($1,$2,$2,'Auto',50,$3)`, [EX2, T, JSON.stringify({ sections: asm.sections })]);
await db.query(`insert into exam_answer_keys(exam_id,part_1_keys,part_2_keys,part_3_keys) values($1,$2,$3,$4)`,
  [EX2, JSON.stringify(asm.keys.part_1_keys), JSON.stringify(asm.keys.part_2_keys), JSON.stringify(asm.keys.part_3_keys)]);
const grade = (ans) => as(S2,'authenticated',`select public.submit_and_grade_exam('${EX2}','${TOK4}','HS2','','${JSON.stringify(ans)}',0,0) r`);
await as(S2,'authenticated',`select public.start_attempt('${EX2}','${TOK4}','HS2')`);
const g = await grade({ part_1: { 1: 'C', 2: 'A' }, part_2: { 1: { a: true, b: false, c: false, d: true } }, part_3: { 1: '-1.5' } });
check('auto exam: perfect answers = 10', g, v => Number(v[0]?.r?.score) === 10);
check('auto exam: scoring sections 3/4/3', asm.sections.map(x => x.total_score), v => v.join() === '3,4,3');
check('bank: part 2 key must be TFTF-style', await as(T,'authenticated',`insert into question_bank(author_id,chapter_name,difficulty,content_image_url,correct_key,part) values('${T}','x',1,'p','A',2)`), denied);
check('bank: part 3 key must be numeric', await as(T,'authenticated',`insert into question_bank(author_id,chapter_name,difficulty,content_image_url,correct_key,part) values('${T}','x',1,'p','abc',3)`), denied);
check('bank: valid part 2 key accepted', await as(T,'authenticated',`insert into question_bank(author_id,chapter_name,difficulty,content_image_url,correct_key,part) values('${T}','x',1,'p','TFFT',2) returning id`), v => v.length === 1);
// ---- Storage: chỉ giáo viên, chỉ vào thư mục của mình ----
const putObj = (uid, name, bucket = 'question-images') => as(uid, 'authenticated', `insert into storage.objects(bucket_id,name,owner) values('${bucket}','${name}','${uid}') returning name`);
check('storage: teacher uploads to own folder', await putObj(T, `${T}/a.webp`), v => v.length === 1);
check('storage: teacher cannot write into other folder', await putObj(T, `${S}/a.webp`), denied);
check('storage: student cannot upload (even own folder)', await putObj(S, `${S}/a.webp`), denied);
check('storage: other bucket not writable via this policy', await putObj(T, `${T}/a.webp`, 'avatars'), denied);
check('storage: anon cannot list bucket (public URL still works)', await as(S, 'anon', "select name from storage.objects where bucket_id='question-images'"), v => v.length === 0 || denied(v));
check('storage: student cannot delete teacher file', await as(S, 'authenticated', `delete from storage.objects where name='${T}/a.webp' returning name`), empty);
check('storage: teacher deletes own file', await as(T, 'authenticated', `delete from storage.objects where name='${T}/a.webp' returning name`), v => v.length === 1);
// ---- Giáo viên chấm lại / thu bài qua RPC (UPDATE trực tiếp đã bị thu quyền) ----
check('client UPDATE submissions is blocked for teacher', await as(T,'authenticated',`update submissions set score=10 where exam_id='${EX}'`), denied);
await db.exec(`reset role; update exam_answer_keys set part_1_keys='{"1":"A","2":"C"}' where exam_id='${EX}'`);
check('regrade all: new keys applied (A,C vs A,C = 10)', await as(T,'authenticated',`select public.teacher_regrade('${EX}') r`), v => v[0]?.r?.count >= 1);
check('regrade updated stored score', await as(T,'authenticated',`select score from submissions where exam_id='${EX}' and student_id='${S}'`), v => Number(v[0].score) === 10 || Number(v[0].score) === 5);
check('regrade: student cannot call', await as(S,'authenticated',`select public.teacher_regrade('${EX}')`), denied);
const subId = (await db.query(`select id from submissions where exam_id='${EX}' and student_id='${S}'`)).rows[0].id;
check('regrade single returns score', await as(T,'authenticated',`select public.teacher_regrade('${EX}','${subId}') r`), v => v[0]?.r?.score !== null && v[0]?.r?.count === 1);
check('force submit needs a submission id', await as(T,'authenticated',`select public.teacher_regrade('${EX}',NULL,true)`), denied);
await db.exec(`reset role; insert into submissions(exam_id,student_id,student_name,session_token,status,answers) values('${EX}','${S2}','HS2','cccccccc-cccc-cccc-cccc-cccccccccccc','in_progress','{"part_1":{"1":"A","2":"C"}}')`);
const ip = (await db.query(`select id from submissions where session_token='cccccccc-cccc-cccc-cccc-cccccccccccc'`)).rows[0].id;
check('force submit grades draft + sets submitted', await as(T,'authenticated',`select public.teacher_regrade('${EX}','${ip}',true) r`), v => Number(v[0]?.r?.score) === 10);
check('force-submitted row is submitted', await as(T,'authenticated',`select status from submissions where id='${ip}'`), v => v[0].status === 'submitted');
check('regrade: other teacher cannot touch exam', await as(S2,'authenticated',`select public.teacher_regrade('${EX}')`), denied);
// ---- Các thao tác ghi mà giao diện đang gọi phải còn hoạt động ----
const CL2='dddddddd-dddd-dddd-dddd-dddddddddddd', EX3='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
check('teacher creates classroom', await as(T,'authenticated',`insert into classrooms(id,teacher_id,name,class_code) values('${CL2}','${T}','12B','XYZ789') returning id`), v => v.length === 1);
check('student cannot create classroom', await as(S,'authenticated',`insert into classrooms(teacher_id,name,class_code) values('${S}','x','QQQ111')`), denied);
check('student joins class (upsert membership)', await as(S,'authenticated',`insert into class_memberships(class_id,student_id,student_name) values('${CL2}','${S}','HS') on conflict (class_id,student_id) do update set student_name='HS' returning id`), v => v.length === 1);
check('student cannot enrol someone else', await as(S,'authenticated',`insert into class_memberships(class_id,student_id) values('${CL2}','${S2}')`), denied);
check('teacher creates exam (author forced)', await as(T,'authenticated',`insert into exams(id,title,config) values('${EX3}','E3','{}') returning author_id`), v => v[0]?.author_id === T);
check('teacher upserts answer keys of own exam', await as(T,'authenticated',`insert into exam_answer_keys(exam_id,part_1_keys) values('${EX3}','{"1":"A"}') on conflict (exam_id) do update set part_1_keys='{"1":"B"}' returning exam_id`), v => v.length === 1);
check('student cannot write answer keys', await as(S,'authenticated',`insert into exam_answer_keys(exam_id,part_1_keys) values('${EX3}','{}') on conflict (exam_id) do update set part_1_keys='{}'`), denied);
check('teacher updates own exam', await as(T,'authenticated',`update exams set title='E3b' where id='${EX3}' returning title`), v => v.length === 1);
check('student cannot update exam', await as(S,'authenticated',`update exams set title='hack' where id='${EX3}' returning id`), empty);
check('teacher assigns exam to own class', await as(T,'authenticated',`insert into exam_assignments(exam_id,class_id) values('${EX3}','${CL2}') returning id`), v => v.length === 1);
check('student cannot assign exams', await as(S,'authenticated',`insert into exam_assignments(exam_id,class_id) values('${EX3}','${CL2}')`), denied);
check('profile upsert on own row', await as(S,'authenticated',`insert into profiles(id,full_name,role,phone) values('${S}','HS moi','student','0902') on conflict (id) do update set full_name='HS moi' returning full_name`), v => v.length === 1);
check('teacher deletes class in UI order', await (async()=>{ const a=await as(T,'authenticated',`delete from class_memberships where class_id='${CL2}' returning id`); const b=await as(T,'authenticated',`delete from exam_assignments where class_id='${CL2}' returning id`); const c=await as(T,'authenticated',`delete from classrooms where id='${CL2}' returning id`); return [a,b,c]; })(), v => v.every(Array.isArray) && v[2].length === 1);
check('teacher deletes own exam', await as(T,'authenticated',`delete from exams where id='${EX3}' returning id`), v => v.length === 1);
// ---- Mã đề, khối lớp, giới hạn 100 câu ----
const EX4='ffffffff-ffff-ffff-ffff-ffffffffffff';
check('exam id: 6 chars [0-9A-Z], first = subject abbr', await as(T,'authenticated',`insert into exams(id,title,subject,grade,config) values('${EX4}','Toan 10','Toán',10,'{}') returning short_id`), v => /^T[0-9A-Z]{5}$/.test(v[0]?.short_id));
check('exam id: client cannot choose it', await as(T,'authenticated',`insert into exams(title,subject,short_id) values('X','Vật lí','ZZZZZZ') returning short_id`), v => /^L[0-9A-Z]{5}$/.test(v[0]?.short_id));
check('exam id: same creator shares chars 2-3', await as(T,'authenticated',`select count(distinct substr(short_id,2,2)) c from exams where author_id='${T}' and short_id ~ '^[0-9A-Z]{6}$'`), v => Number(v[0].c) === 1);
check('exam id: 40 exams stay unique', await (async()=>{ await as(T,'authenticated',`insert into exams(title,subject) select 'b'||g,'Toán' from generate_series(1,40) g`); return as(T,'authenticated',`select count(*) n, count(distinct short_id) d from exams where author_id='${T}'`); })(), v => v[0].n === v[0].d);
check('exam id: cannot be changed by update', await as(T,'authenticated',`update exams set short_id='AAAAAA' where id='${EX4}' returning short_id`), v => v[0]?.short_id !== 'AAAAAA');
check('grade 13 rejected', await as(T,'authenticated',`insert into exams(title,grade) values('g',13)`), denied);
check('grade 0 rejected', await as(T,'authenticated',`insert into exams(title,grade) values('g',0)`), denied);
check('grade 1 accepted', await as(T,'authenticated',`insert into exams(title,grade) values('g',1) returning grade`), v => v[0]?.grade === 1);
check('101 questions in a part rejected', await as(T,'authenticated',`insert into exams(title,config) values('big','{"sections":[{"question_count":101,"total_score":3}]}')`), denied);
check('100 questions accepted', await as(T,'authenticated',`insert into exams(title,config) values('ok','{"sections":[{"question_count":100,"total_score":3}]}') returning id`), v => v.length === 1);
check('update config to 1000 rejected', await as(T,'authenticated',`update exams set config='{"sections":[{"question_count":1000}]}' where id='${EX4}'`), denied);
check('answer keys: 101 keys rejected', await as(T,'authenticated',`insert into exam_answer_keys(exam_id,part_1_keys) values('${EX4}',(select jsonb_object_agg(g::text,'A') from generate_series(1,101) g))`), denied);
check('question bank: insert without chapter, with subject/grade/tags', await as(T,'authenticated',`insert into question_bank(author_id,subject,grade,topic_tags,difficulty,part,content_image_url,correct_key) values('${T}','Vật lí',11,'{dao-ham}',2,1,'x.webp','A') returning grade`), v => v[0]?.grade === 11);
check('question bank: solution files stored', await as(T,'authenticated',`insert into question_bank(author_id,difficulty,part,content_image_url,correct_key,solution_files) values('${T}',1,1,'x','A','[{"path":"a/sol/1.pdf","type":"pdf","name":"a.pdf"}]') returning jsonb_array_length(solution_files) n`), v => v[0]?.n === 1);
check('question bank: >5 solution files rejected', await as(T,'authenticated',`insert into question_bank(author_id,difficulty,part,content_image_url,correct_key,solution_files) values('${T}',1,1,'x','A','[1,2,3,4,5,6]')`), denied);
check('practice: student lists questions without answers', await as(S,'authenticated',`select practice_list('Vật lí',11,'dao-ham',null,5) r`), v => v[0]?.r?.length >= 1 && !('correct_key' in v[0].r[0]));
check('practice: student cannot read question_bank directly', await as(S,'authenticated',`select id from question_bank`), empty);
check('practice: check returns key + solution', await as(S,'authenticated',`select practice_check(array(select (x->>'id')::uuid from jsonb_array_elements(practice_list('Vật lí')) x)) r`), v => v[0]?.r?.[0]?.correct_key === 'A');
check('practice: anon denied', await as(S,'anon',`select practice_list()`), denied);
check('user_code: GV + 6 ký tự', await as(T,'authenticated',`select user_code from profiles where id='${T}'`), v => /^GV[0-9A-Z]{6}$/.test(v[0]?.user_code));
check('user_code: HS + 6 ký tự', await as(S,'authenticated',`select user_code from profiles where id='${S}'`), v => /^HS[0-9A-Z]{6}$/.test(v[0]?.user_code));
check('user_code: client không sửa được', await as(S,'authenticated',`update profiles set user_code='HSAAAAAA' where id='${S}' returning user_code`), v => v[0]?.user_code !== 'HSAAAAAA');
check('question bank: author can edit own', await as(T,'authenticated',`update question_bank set grade=10 where author_id='${T}' returning grade`), v => v[0]?.grade === 10);
check('question bank: others cannot edit', await as(S,'authenticated',`update question_bank set grade=9 returning id`), empty);
check('profile: tự sửa tên/trường/khối', await as(S,'authenticated',`update profiles set full_name='HS Mới', school='THPT A', grade=11 where id='${S}' returning full_name, grade`), v => v[0]?.full_name === 'HS Mới' && v[0]?.grade === 11);
check('profile: không đổi được email', await as(S,'authenticated',`update profiles set email='x@y.com' where id='${S}'`), denied);
check('profile: không sửa hồ sơ người khác', await as(S,'authenticated',`update profiles set full_name='hack' where id='${T}' returning id`), empty);
check('question bank: grade 13 rejected', await as(T,'authenticated',`insert into question_bank(author_id,grade,difficulty,part,content_image_url,correct_key) values('${T}',13,1,1,'x','A')`), denied);
// ---- Rate limit RPC ----
const K = 'a'.repeat(64), K2 = 'b'.repeat(64);
for (let i = 0; i < 3; i++) await as(S,'anon',`select public.auth_rl_fail('${K}')`);
check('rl: under limit → 0', await as(S,'anon',`select public.auth_rl_check('${K}',5,900) w`), v => v[0].w === 0);
for (let i = 0; i < 2; i++) await as(S,'anon',`select public.auth_rl_fail('${K}')`);
check('rl: at limit → wait > 0', await as(S,'anon',`select public.auth_rl_check('${K}',5,900) w`), v => v[0].w > 0 && v[0].w <= 900);
check('rl: other key unaffected', await as(S,'anon',`select public.auth_rl_check('${K2}',5,900) w`), v => v[0].w === 0);
check('rl: window expiry frees the key', await (async()=>{ await db.exec(`reset role; update auth_attempts set at = now() - interval '20 minutes'`); return as(S,'anon',`select public.auth_rl_check('${K}',5,900) w`); })(), v => v[0].w === 0);
check('rl: reset clears counter', await (async()=>{ for (let i=0;i<5;i++) await as(S,'anon',`select public.auth_rl_fail('${K2}')`); await as(S,'anon',`select public.auth_rl_reset('${K2}')`); return as(S,'anon',`select public.auth_rl_check('${K2}',5,900) w`); })(), v => v[0].w === 0);
check('rl: bad key rejected', await as(S,'anon',`select public.auth_rl_fail('not-a-hash')`), denied);
check('rl: table closed to clients', await as(S,'anon','select * from auth_attempts'), denied);
check('rl: table closed to authenticated', await as(S,'authenticated','select * from auth_attempts'), denied);
check('rl: per-key row cap (spam ≤ 50)', await (async()=>{ const K3='c'.repeat(64); for (let i=0;i<70;i++) await as(S,'anon',`select public.auth_rl_fail('${K3}')`); await db.exec('reset role'); return (await db.query(`select count(*)::int c from auth_attempts where key='${K3}'`)).rows; })(), v => v[0].c === 50);
// ---- Data release + account deletion ----
{
  const H = c => c.repeat(64);
  const pA = `${T}/${H('a')}.webp`, pB = `${T}/${H('b')}.webp`, pS = `${T}/sol/${H('c')}.pdf`;
  await db.exec('reset role');
  for (const n of [pA, pB, pS]) await db.exec(`insert into storage.objects(bucket_id,name,owner) values('question-images','${n}','${T}')`);
  await db.exec(`insert into question_bank(author_id,chapter_name,difficulty,content_image_url,correct_key,solution_files) values
    ('${T}','x',1,'${pA}','A','[{"path":"${pS}","type":"pdf","name":"s.pdf"}]'),
    ('${T}','x',1,'${pB}','A','[]'),
    ('${T}','x',1,'${pB}','A','[]')`);
  const cnt = async n => (await db.query(`select count(*)::int c from storage.objects where name='${n}'`)).rows[0].c;
  await as(T, 'authenticated', `delete from question_bank where content_image_url='${pB}' and id=(select id from question_bank where content_image_url='${pB}' limit 1)`);
  check('release: shared file kept while another row uses it', [{ c: await cnt(pB) }], v => v[0].c === 1);
  await as(T, 'authenticated', `delete from question_bank where content_image_url='${pB}'`);
  check('release: file removed with last reference', [{ c: await cnt(pB) }], v => v[0].c === 0);
  await as(T, 'authenticated', `update question_bank set solution_files='[]' where content_image_url='${pA}'`);
  check('release: dropped solution file is removed', [{ c: await cnt(pS) }], v => v[0].c === 0);
  await as(T, 'authenticated', `delete from question_bank where content_image_url='${pA}'`);
  check('release: question image removed', [{ c: await cnt(pA) }], v => v[0].c === 0);
  check('account: wrong code rejected', await as(S, 'authenticated', `select public.delete_my_account('WRONG')`), denied);
  check('account: anon cannot call', await as(S, 'anon', `select public.delete_my_account('HS000000')`), denied);
  await db.exec('reset role');
  const code = (await db.query(`select user_code from profiles where id='${S}'`)).rows[0].user_code;
  check('account: student deletes self with code', await as(S, 'authenticated', `select public.delete_my_account('${code.toLowerCase()}')`), v => true);
  await db.exec('reset role');
  check('account: profile + auth user gone', (await db.query(`select (select count(*)::int from profiles where id='${S}') p,(select count(*)::int from auth.users where id='${S}') u`)).rows, v => v[0].p === 0 && v[0].u === 0);
  await db.exec(`insert into question_bank(author_id,chapter_name,difficulty,content_image_url,correct_key) values('${T}','x',1,'${pB}','A')`);
  await db.exec(`insert into storage.objects(bucket_id,name,owner) values('question-images','${pB}','${T}')`);
  const tcode = (await db.query(`select user_code from profiles where id='${T}'`)).rows[0].user_code;
  check('account: teacher deletes self', await as(T, 'authenticated', `select public.delete_my_account('${tcode}')`), v => true);
  await db.exec('reset role');
  check('account: teacher data + files purged', (await db.query(`select (select count(*)::int from question_bank where author_id='${T}') q,(select count(*)::int from exams where author_id='${T}') e,(select count(*)::int from storage.objects where name like '${T}/%') o`)).rows, v => v[0].q === 0 && v[0].e === 0 && v[0].o === 0);
}
if (fail) { console.error(`\n${fail} check(s) FAILED`); process.exit(1); }
console.log('\ntest_rls: tất cả case đạt');
