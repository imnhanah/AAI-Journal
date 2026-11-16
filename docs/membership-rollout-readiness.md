# Membership production-readiness runbook

Updated November 14, 2026. **Production enforcement remains NO-GO.**

## Completed and current state

The hosted staging project is `tenktwvkxjqsnamlfhcp`. Production was not accessed in this phase. Previously passed baseline, enforcement/rollback, private-image and cross-browser promotion tests remain evidence; do not rerun enforcement to perform recovery work.

The temporary staging promotion test RPC was verified with five `PT409` conflict codes and safely removed. It is absent by design. The corrected future-install source is `supabase/membership_journal_promotion.sql`, which checks the existing entitlement RPC and does not depend on enforcement being active. Historical package copies containing `40001` are not current install sources.

The administrator stale-edit guard is corrected locally and in staging: one `40001` became `PT409`, retaining all authorization, locks, optimistic checks, audit/write behavior and privileges. Use `membership_administration.sql` only for a fresh installation. Use `membership_administration_conflict_correction.sql` for an existing, reviewed matching installation. Production source/identity/ACL must be independently reviewed under separate approval before the upgrade; never rerun the full administration installer on a deployed system.

Administrator status remains independent of Owner membership. The UI cannot grant administrator rights. Neither this correction nor recovery work changes memberships, profile cloud flags, admin grants, RLS or enforcement.

## Owner-operated device recovery

**Journal Setup → Data & backup → Export device recovery archive** opens `/device-recovery` in both desktop and mobile layouts. The route is independent of membership preview and does not mount journal synchronization. It works with either existing cloud/local journal routing without changing it. Production deployment of this client is not authorized by local/staging verification.

Before export, the account holder saves or separately preserves unfinished editors, pauses edits, confirms the displayed account and labels this exact device/profile. Repeat for every Safari/Chrome/mobile profile and app origin; localhost and 127.0.0.1 are distinct. Do not clear storage, sign out, or toggle production cloud flags to reach device records.

The exporter reads existing owner-scoped stores twice and refuses a changing source. It captures raw local journals, all recovery snapshots, journal/image caches, shared image metadata and original binaries, upload queue/lease evidence, referenced legacy evidence/document images, Case Study pending/conflict/history, local operation recovery records, Daily Routine, device preferences, import mappings, legacy Strategy keys and the current verified email's pre-cloud journal. Authentication storage and other owners' rows are excluded. Legacy unassigned images, missing bytes, checksum differences, unreadable/unreviewed stores and unresolved extracted references require review.

The JSON archive binds owner UUID, origin/profile label, SHA-256 and binary hashes. Keep it immutable. Download each relevant journal/snapshot/pending/conflict copy separately; no implicit merge occurs. Legacy raw settings and queues remain in the archive even if a portable journal is chosen. Blob-only or remote-only references without retained bytes remain unresolved; the export never downloads arbitrary external/private cloud images.

**Verify restore in separate storage** first validates the archive, decodes raw and inline image originals, and restores exact raw records/settings into newly named verification databases. Journal sync never reads those names; queue/lease/cloud settings are not reactivated. Existing journals, evidence and snapshots are not replaced. A partial decode or an archive warning means recovery remains incomplete.

Offline inspection is available without an authenticated session. Exporting this browser requires authoritative authentication of the account holder. Independent reviewers inspect only files the owner explicitly supplies; they do not inspect the person's live private browser storage.

## Independent validation

Run the offline validator on an owner-supplied device archive:

```sh
node scripts/verify-device-archive.mjs DEVICE_FILE --owner VERIFIED_AUTH_UUID --report NEW_REPORT
```

Known real-account UUIDs are refused before reading the file unless an explicitly approved operation supplies `--allow-approved-real-backup`. Reports are created with restrictive permissions and never overwrite an existing report. This tool verifies owner/store scope and hashes; it never certifies READY or replaces browser image decoding/offline restoration.

Validate portable/cloud journal files using the prepared `verify_backup.py`, then restore copies in an empty isolated/offline journal profile. Block backend traffic, reload, and compare records, values, relationships, pending copies, snapshots and every attachment in WebKit and Chromium where possible. Never upload real journals to hosted synthetic staging. Preserve raw files, receipts and divergent source copies. A raw verification-store comparison alone does not prove every portable copy or every other device is complete.

## Two legacy Free accounts

Accounts ending `4da7e7f7` and `eb527283` are **NOT READY**. Historical November 13 counts are not fresh inventories. Full UUIDs and individual procedures are recorded in the account-specific final-readiness documents. No real backup or new production inventory was created.

For each account separately:

1. Obtain account-specific owner consent and approval for production reads/exports. Independently verify the full UUID against their own session.
2. Refresh all journal/Case Study/Strategy counts, revisions, embedded screenshots and owner-scoped private Storage inventories under approved read-only access.
3. Owner exports a cloud recovery file and every device archive. A separate independently restorable raw record/relationship/revision backup and original private Storage bytes, including unreferenced objects, must also be verified. Referenced-image portable export alone is insufficient.
4. Compare before/after inventories, file/binary hashes, image decode, raw and portable restorations, all source devices and unresolved references. An independent verifier and account holder sign a receipt. Resolve divergences explicitly without deleting originals.
5. Mark an account READY only after its current cloud and all relevant device copies are independently restorable. Both accounts must pass before production restrictions can be considered.

## Approval and activation gates

The following are separate from completed local/staging work:

- Production read-only schema/deployed-function/aggregate inventory access and a separately scoped secure connection. Do not reuse the staging token or infer a target from a production-linked CLI directory.
- Production deployment of the reviewed recovery-only client and matching administrator PT409 upgrade, initially keeping entitlement preview false and live memberships/cloud flags unchanged.
- Separate real-user backup/export approval and owner involvement for each full UUID. No agent impersonation, account reset or administrator journal viewer.
- Independent verification of both backups and source-device recovery, plus the remaining signed-upload/cutover and release checks.
- Explicit production activation approval and a reviewed change window/rollback package. Until then, do not apply enforcement or change account entitlements.

For a later approved activation: reverify source/version/policy inventory and both account receipts; preserve deployed client/Edge Function/function definitions and permissions; apply only reviewed missing upgrades; deploy the tested routing/entitlement client and enforcement/promotion components in their reviewed order; smoke-test designated accounts. Rollback restores previous enforcement/client routing while retaining records, objects, audit history and legitimate membership changes. Do not blindly rerun an installation manifest. The administrator error-contract safety correction can remain installed during an enforcement rollback.

## Current recommendation

The preparation package is ready for review after focused tests and staging preservation pass. **Production enforcement is NO-GO** until the real-account recovery, production review/deployment, remaining release gates and explicit activation approval are complete.
