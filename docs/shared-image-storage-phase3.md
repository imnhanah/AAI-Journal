# Phase 3 shared image-storage foundation

`src/sharedImageStorage.js` is the local-first image boundary for new module
integrations. It creates a user-scoped IndexedDB database named
`tj-image-assets` (version 1) with `assets`, `binaries`, and `queue` stores.
The asset metadata and its binary are deliberately separate: structured record
synchronization never proves that image bytes were uploaded.

## Storage model

- `assets`: metadata keyed by stable asset id, including owner UUID, source,
  checksum, state, revision, cloud path, and soft-delete dates.
- `binaries`: local `Blob` copies keyed by asset id and guarded against a
  different `ownerUserId` at the service boundary.
- `queue`: persistent Owner upload operations, keyed by `upload:<assetId>`.

The service validates new PNG, JPEG, and WebP uploads by file signature and
limits them to 5 MiB. It does not validate, compress, migrate, or remove
historical assets.

## Membership and cloud queue

Only a current `{ status: 'ready', membership: 'owner' }` result can create or
process a cloud-upload queue item. Free, missing, and failed membership results
remain `local-only`; reconnecting cannot enqueue them. The cloud uploader is
intentionally injected by a module integration and must report `{ verified:
true, cloudPath }` before an asset becomes `cloud-verified`.

No Storage policy, bucket limit, database record, or cloud object is modified
by this foundation.

## Module integration inventory

| Module | Current image path | Phase 3 status | Next safe step |
| --- | --- | --- | --- |
| Case Study evidence | `tj-case-study-evidence-images`, existing private Storage references | Compatibility retained | Adopt shared service at new-upload entry after Owner/Free workflow UI review. |
| Case Study rich documents | `tj-case-study-document-images` | Compatibility retained | Add shared-service adapter without changing document references. |
| Chart Viewer / markups | legacy references and journal image cache | Compatibility retained | Map new annotations to asset ids and retain `tj-image:` reads. |
| Trade Journal / reviews | JSONB screenshots and `tj-journal-images` | Compatibility retained | Introduce a screenshot adapter after record-sync contract review. |
| Strategy Testing / Backtesting | existing screenshot fields | Not migrated | Inventory actual input/read paths before integration. |
| Profiles / avatars / playbooks | data URLs | Not migrated | Replace only future upload entry points with the shared service. |

Legacy `cloudRef`, `tj-image:`, Case Study local prefixes, data URLs, and HTTP
URLs remain valid inputs to their existing readers. Phase 3 adds no bulk image
migration and does not activate `case_study_evidence_owner_upload_activation.sql`.
