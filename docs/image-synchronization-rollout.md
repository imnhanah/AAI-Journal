# Image synchronization: local candidate, not activated

This release changes image authorization only. It does not enable whole-journal
membership enforcement, change memberships or `profiles.cloud_sync_enabled`,
activate device journals, merge local/cloud copies, or alter administrator roles.
Existing device-only/off choices remain respected; image grants never silently
switch a journal into another storage mode.

## Intended permissions

`001_image_authorization.sql` preserves exactly the two approved current Owner
UUIDs in protected image grants. Its first-install identity check stops if that
inventory differs. Membership promotions after installation do not automatically
grant images. Independent administrator RPCs manage other users' image grants.
No normal client can read/write the private grant tables, change a protected
Owner grant, or grant administrator privileges. Existing authenticated, owner-
scoped Storage reads remain unchanged. An image grant does not grant journal
ownership or access to another user's images.

A failed/missing image-permission RPC fails closed for new uploads while keeping
original device bytes. Do not ship the new client before its entitlement RPC
exists. Explicit denial becomes local-only; temporary permission failures keep
existing queued work retryable. Authorization is checked again by Storage RLS
and by the new-image database trigger, regardless of client state.

## Before any hosted execution

Separate authorization is required. Verify the target independently of the CLI
link. Use synthetic accounts only in staging; never copy production Auth users,
private records or images. For staging, generate and review a target-specific
bootstrap copy with exactly two designated synthetic Owner UUIDs. Do not weaken
or remove the production script's identity guard to make a staging run pass.

Capture current schema/RPC/policy/permission metadata, ownership and reference
counts. Verify protected account/auth fields, both Owner identities, the private
3 MiB bucket, existing read policies and the unchanged journal permissions.
Retain recoverable checkpoints. Each legacy Free account still needs its own
independently verified backup and owner-operated device exports. A metadata
inventory is not a backup, and a passing checksum is not a complete image restore.

Review the three SQL files and their recorded hashes. They are not automatically
run by Vite/npm or any deployment hook. Run actual hosted JWT/REST/RPC/Storage
security tests in staging before authorizing production activation. Local PGlite
and mocked HTTP tests do not prove deployed gateway/JWT behavior.

## Proposed installation order, after approval

1. Apply `001_image_authorization.sql`. It creates only image permission/audit
   infrastructure, protects the two approved Owners, and changes only the known
   Storage INSERT policy. It refuses unexpected write-policy drift. Verify both
   protected grants and authenticated Owner access; verify ordinary users cannot
   use the administrative RPCs. Do not alter their membership/cloud flags.
2. Deploy the reviewed client through the existing pipeline, with existing public
   Supabase URL/anon credentials and `VITE_MEMBERSHIP_ADMIN_UI=true`, while keeping
   `VITE_MEMBERSHIP_ENTITLEMENTS_PREVIEW=false`. Administration was hidden in the
   audited production release because its independent UI flag was absent; no
   authorization bypass or Owner-to-administrator promotion is necessary.
3. Confirm normal journal operation and updated client availability, then apply
   `002_image_binary_guards.sql`. Existing old tabs can still save ordinary data
   and unchanged legacy images, but attempts to add image binaries through an old
   Markup client will be rejected. Ask users to reload; do not clear their data.
4. Verify grants/denials with authorized synthetic staging sessions; verify direct
   owned-table and RPC writes cannot introduce image binaries without permission,
   including nested JSON, serialized settings and Auth image metadata. Confirm
   existing Free images remain readable. Verify no new whole-journal restriction.
5. Use a fresh production preservation checkpoint and non-destructive smoke tests
   for the approved production step. No real user image export is authorized by
   this local implementation. Obtain the required separate approvals first.

All existing owned public tables receive a trigger that checks only newly added
image binary values/occurrences. Unchanged historical images, including images
above the new limit, are not rewritten or revalidated as new uploads. Normal
scalar writes remain subject to their existing ownership RLS, with no image-grant
requirement. Future owned tables must be included by a reviewed migration/reapply.

## Images and caching

New uploads accept at most 3,145,728 bytes. Oversized files receive an explicit
error; smaller screenshots are not resampled or recompressed. Historical originals
are never resized, deleted or migrated by these scripts. Markups, trades, reviews,
Case Study documents/evidence, Strategy Testing and profile photos use the shared
local-first infrastructure; display-only data URLs are omitted from save payloads.

Downloaded originals use a separate cache (`tj-cloud-image-cache`), bounded to
96 entries / 32 MiB with a seven-day TTL. Keys contain project namespace, owner,
immutable cloud path and optional revision. Stored bytes are checksummed. New image
replacements use new immutable paths; explicit revision keys cannot reuse an older
revision. Cache expiry, eviction and account-change cleanup touch downloaded copies
only, never original image assets, drafts, pending operations or cloud objects.
Signed URLs remain in memory only. First-upload checksum read-back is retained.

Known local-only references do not probe Storage; unknown historical references
retain their existing recovery fallback. Case Study thumbnails wait until near the
viewport. The client shows the local-image backup warning. The image capability is
refreshed on foreground/focus and at upload boundaries, without polling.

## Recovery and conditional reversal

The existing `/device-recovery` route remains; no old phone-panel export link was
reintroduced. New archives include only this owner's/project's downloaded cache
bytes, original local images, durable drafts and inert recovery evidence. Restores
never automatically replay pending image uploads or journal operations.

Old release f858399 cannot directly parse a raw archive containing the newly added
cache database. Keep the raw archive unchanged. The separately built standalone
`recovery-bridge/tools/device-recovery-bridge.html` validates it and materializes
one selected journal copy for the older import handler. It refuses unresolved
image warnings and refuses to turn drafts-only evidence into an empty journal.
Drafts and pending-operation evidence remain in the original raw archive and can
be verified/restored into isolated stores with the current reader. The ordinary
older-client copy intentionally excludes that newer raw sidecar; do not discard
it. Test recovery in an isolated profile before replacing any device journal.
The bridge makes no Supabase calls and never activates queues.

`003_conditional_rollback.sql` is an incident-only permission reversal, not a third
installation step. Separate approval is required for any hosted reversal. It removes
only this migration's image guards and restores the audited Owner-only Storage
INSERT rule, retaining grant/audit evidence, all records, images and metadata.
Do not reset memberships, clear browser storage, delete objects or restore an old
whole database snapshot. Retain the current compatible reader/bridge when testing
an older client. Local reversal testing used only a disposable synthetic database.

Atomic savings, duplicate-safe server retries and complete server revision
coverage remain deferred. Calendar forced-refresh behavior is unchanged and is
not a claimed image-egress improvement.
