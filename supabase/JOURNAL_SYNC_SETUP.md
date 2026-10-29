# Enable low-egress journal sync

1. Open the project's **SQL Editor** in Supabase.
2. Run `journal_low_egress_migration.sql` once. It preserves all existing rows and screenshots, adds update timestamps where needed, and installs three RLS-respecting functions. It does not create public image URLs or change table policies.
3. Reload the journal, or press **Sync**. The first successful sync builds a browser snapshot of records with lightweight screenshot references. Subsequent syncs download changed rows and deletion IDs only.

Screenshots remain in their existing private database rows for now. The app downloads an individual screenshot only when its preview becomes visible, then caches it in IndexedDB under its owner and revision. New/changed images are downloaded again; unchanged images reuse the browser copy. Saving a record resolves its existing image references before writing, preserving captions and removed images correctly.

If the migration is missing, the app keeps existing cached data visible and shows a sync warning. A browser with no journal cache cannot load cloud records until setup is completed. There is deliberately no silent full-history/image download fallback.

## Verify after setup

- Open the browser Network panel, filter for `tj_sync_journal`, then press Sync twice. The second response should contain empty `rows` and `deleted` arrays for unchanged tables.
- Open a trade/markup with a screenshot. Only visible previews should request `tj_journal_image`. Reopening the same image should use its browser cache.
- Edit a trade in another browser and Sync here: its new values should appear without downloading unrelated records or screenshots.
- Delete a test record in another browser and Sync here: the deleted ID should disappear locally. Test only with disposable records.
- Sign in as a different user: the original user's cached records/images must not be displayed.
- Compare new daily Database Egress growth in Supabase Usage, not the accumulated billing-cycle total.

The cache is not a backup; clearing browser storage or using a new device requires one fresh record sync and fresh downloads for images opened there. Cloud sync is checked on app load and on explicit Sync, not on a constant polling timer.
