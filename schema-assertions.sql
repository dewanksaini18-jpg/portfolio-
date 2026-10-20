\set ON_ERROR_STOP on
-- fixtures (as superuser)
insert into auth.users (id,email) values ('11111111-1111-1111-1111-111111111111','admin@test'),('22222222-2222-2222-2222-222222222222','stranger@test') on conflict do nothing;
insert into public.admins (user_id) values ('11111111-1111-1111-1111-111111111111') on conflict do nothing;
delete from public.projects; delete from public.bookings; delete from public.content_items; delete from public.site_settings;
insert into public.projects (slug,title,published) values ('vis','Visible',true),('hid','Hidden',false);
insert into public.content_items (collection,data,published) values ('faq','{"q":1}',true),('faq','{"q":2}',false);
insert into public.site_settings (key,value) values ('brand','{"name":"X"}');
insert into public.bookings (name,email) values ('A','a@a.com');

create or replace function pg_temp.expect(label text, ok boolean) returns void language plpgsql as $$
begin if ok then raise notice 'PASS  %', label; else raise exception 'FAIL  %', label; end if; end $$;

-- anon visitor
set role anon;
select pg_temp.expect('anon sees only published projects', (select count(*) from public.projects)=1);
select pg_temp.expect('anon sees only published content', (select count(*) from public.content_items)=1);
select pg_temp.expect('anon reads settings', (select count(*) from public.site_settings)=1);
do $$ begin perform 1 from public.bookings; raise exception 'FAIL anon read bookings'; exception when insufficient_privilege then raise notice 'PASS  anon cannot read bookings'; end $$;
do $$ begin insert into public.bookings (name,email) values ('x','x@x'); raise exception 'FAIL anon insert bookings'; exception when insufficient_privilege then raise notice 'PASS  anon cannot insert bookings'; end $$;
do $$ begin insert into public.projects (slug,title) values ('evil','Evil'); raise exception 'FAIL anon insert project'; exception when insufficient_privilege then raise notice 'PASS  anon cannot insert projects'; end $$;
reset role;

-- signed-in stranger (not an admin)
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.expect('stranger sees only published projects', (select count(*) from public.projects)=1);
select pg_temp.expect('stranger sees no bookings', (select count(*) from public.bookings)=0);
do $$ begin insert into public.projects (slug,title) values ('evil','Evil'); raise exception 'FAIL stranger insert project'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS  stranger cannot insert projects (%)', sqlerrm; end $$;
do $$ declare n int; begin update public.projects set title='hacked'; get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL stranger update changed % rows', n; end if; raise notice 'PASS  stranger update affects 0 rows'; end $$;
do $$ begin insert into storage.objects (bucket_id,name) values ('media','x.png'); raise exception 'FAIL stranger upload'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS  stranger cannot upload (%)', sqlerrm; end $$;
select pg_temp.expect('stranger cannot see admins row of others', (select count(*) from public.admins)=0);
reset role;

-- admin
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.expect('admin sees hidden projects too', (select count(*) from public.projects)=2);
select pg_temp.expect('admin sees hidden content too', (select count(*) from public.content_items)=2);
select pg_temp.expect('admin sees bookings', (select count(*) from public.bookings)=1);
select pg_temp.expect('admin sees own admins row', (select count(*) from public.admins)=1);
insert into public.projects (slug,title) values ('new','New');
select pg_temp.expect('admin can insert project', (select count(*) from public.projects)=3);
update public.projects set title='Renamed' where slug='new';
select pg_temp.expect('updated_at trigger ran', (select updated_at > created_at from public.projects where slug='new'));
update public.bookings set status='contacted';
select pg_temp.expect('admin can update bookings', (select status from public.bookings limit 1)='contacted');
insert into storage.objects (bucket_id,name) values ('media','ok.png');
select pg_temp.expect('admin can upload to media', (select count(*) from storage.objects where name='ok.png')=1);
delete from public.projects where slug='new';
select pg_temp.expect('admin can delete project', (select count(*) from public.projects)=2);
do $$ begin insert into public.projects (slug,title,aspect) values ('bad','Bad','weird'); raise exception 'FAIL aspect check'; exception when check_violation then raise notice 'PASS  aspect check constraint'; end $$;
do $$ begin insert into public.content_items (collection,data) values ('plans','{}'); raise exception 'FAIL pricing collection exists'; exception when check_violation then raise notice 'PASS  there is no pricing collection'; end $$;
reset role;
select pg_temp.expect('bucket media is public with limit', (select public and file_size_limit=52428800 from storage.buckets where id='media'));
