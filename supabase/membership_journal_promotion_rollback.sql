-- Removes the publishing endpoint. Previously published records are retained.
begin;
drop function public.tj_publish_device_journal(jsonb, jsonb, boolean);
commit;
