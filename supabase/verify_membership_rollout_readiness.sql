-- Run in the privileged dashboard. Outputs account labels and counts only.
-- Account labels are for a single inventory run, not permanent identifiers.
-- Compare with an owner-run device inventory and a tested backup before cutover.
begin transaction read only;

with people as (
  select u.id,
         row_number() over (order by u.id) as account_label,
         coalesce(m.membership, 'free') as membership,
         m.user_id is not null as explicit_membership,
         coalesce(p.cloud_sync_enabled, false) as profile_cloud_flag
  from auth.users u
  left join public.tj_memberships m on m.user_id = u.id
  left join public.profiles p on p.id = u.id
)
select 'Account ' || p.account_label as account,
       p.membership, p.explicit_membership, p.profile_cloud_flag,
       p.membership = 'free' and p.profile_cloud_flag as needs_transition,
       (select count(*) from public.accounts t where t.user_id = p.id) as workspaces,
       (select count(*) from public.trades t where t.user_id = p.id) as trades,
       (select count(*) from public.premarket_markups t where t.user_id = p.id) as markups,
       (select count(*) from public.trade_reviews t where t.user_id = p.id) as trade_reviews,
       (select count(*) from public.period_reviews t where t.user_id = p.id) as period_reviews,
       (select count(*) from public.backtest_runs t where t.user_id = p.id) as test_runs,
       (select count(*) from public.backtest_trades t where t.user_id = p.id) as test_trades,
       (select revision from public.profile_case_study_libraries t where t.user_id = p.id) as case_study_revision,
       (select case when jsonb_typeof(t.library->'studies') = 'array'
                    then jsonb_array_length(t.library->'studies') else 0 end
        from public.profile_case_study_libraries t where t.user_id = p.id) as case_studies,
       (select case when jsonb_typeof(t.library->'evidence') = 'array'
                    then jsonb_array_length(t.library->'evidence') else 0 end
        from public.profile_case_study_libraries t where t.user_id = p.id) as evidence_records,
       (select count(*) from storage.objects o
        where o.bucket_id = 'case-study-evidence' and (storage.foldername(o.name))[1] = p.id::text) as private_images
from people p
order by needs_transition desc, account_label;

rollback;
