# EDI Revamp Implementation Plan

## Scope

Implement the EDI module in this Laravel project using `inventory`/`fjp_inventory` as the source of movement records.

The vanilla system confirms that gate-out creates a new inventory row linked to the gate-in row. Every inventory row is therefore an independent movement event:

- `gate_status = IN` produces an IN message and uses the `GIE` filename marker.
- `gate_status = OUT` produces an OUT message and uses the `GOE` filename marker.

## Locked business rules

1. A profile supports IN, OUT, or BOTH.
2. The profile baseline is `enabled_at`, not `created_at`.
3. Only inventory rows created at or after `enabled_at` are eligible.
4. A row is eligible only when its client and direction match the profile.
5. A successful send permanently excludes a transaction.
6. IN and OUT use separate uploaded CODECO D95B templates and mappings.
7. Missing/unmapped optional fields are skipped and logged; valid fields continue.
8. One file contains all eligible unsent rows for one profile, direction, and run.
9. No eligible rows means no file and no delivery attempt.
10. States are `pending`, `generating`, `generated`, `sending`, `sent`, `failed`, and `retry_pending`.
11. Failed delivery retries three times with a two-minute delay by default.
12. All schedule and audit timestamps use `Asia/Manila`.
13. Existing queued work keeps its profile version; new work uses the updated profile version.

## Implementation order

1. Verify and preserve the existing gate-in/gate-out inventory flow.
2. Add profile baseline, direction/template, transaction, artifact, and delivery-log storage.
3. Encrypt destination credentials and support SFTP, FTP, FTPS, and HTTPS/API.
4. Replace broad inventory selection with direction-aware, baseline-aware, duplicate-safe selection.
5. Add CODECO template upload, mapping suggestions, and manual mappings.
6. Implement template-preserving generation and `CLIENTGIE...`/`CLIENTGOE...` filenames.
7. Implement automatic scheduling, Generate Now, and Retry.
8. Rebuild the EDI UI with paginated logs above paginated profiles.
9. Remove obsolete EDI-only structures only after replacement paths are verified.
10. Run migrations, static checks, frontend build, and targeted tests.

## Verification checklist

- IN and OUT are separate inventory rows and dispatch records.
- Disabled profiles never create automatic dispatches.
- Enabling a profile establishes `enabled_at` and excludes older inventory rows.
- Profile edits do not rewrite queued transaction snapshots.
- Duplicate scheduler runs cannot claim the same movement twice.
- Transactions become `sent` only after adapter success.
- Failed delivery remains visible and retryable.
- No-record runs create no empty file.
- Manila-time windows, overnight windows, and intervals work correctly.
- Artifacts preserve the uploaded sample structure and selected mappings.

## Current implementation status

Completed in Laravel:

- `fjp_inventory`/`inventory` direction-aware eligibility using `gate_status` and `enabled_at`.
- Independent IN and OUT direction templates, mapping suggestions, administrator mappings, and checked output-field filtering.
- Immediate server-side sample analysis on upload: only the first UNH-to-UNT message structure is used for mapping analysis, while the original template order and static values are preserved. Repeated transaction structures are deduplicated in the mapping choices.
- Two-column manual mapping controls: enabled inventory output fields are matched against unique detected CODECO segment/element candidates; suggestions are advisory and administrator selections are saved as confirmed mappings.
- `codeco` D95B catalog migration/model/seeder with official UNECE source references, CODECO segment meanings, mandatory/conditional usage, repetition, and commonly used CODECO qualifier values including `CN`, `CF`, `FCL`, and `LCL`.
- Versioned transaction snapshots so queued work keeps the old profile configuration after edits.
- Generation and delivery state machine, private stored artifacts, download metadata, retries, and retry actions.
- SFTP, FTP, FTPS, HTTP/HTTPS API delivery adapters with encrypted credentials.
- Manila-time scheduling, blank/partial/overnight time windows, Generate Now, and automatic scheduler dispatch.
- Paginated EDI Logs above paginated profile data in the EDI page.
- Replacement migrations and removal of the four empty legacy dispatch tables.

Verification completed:

- Laravel migrations applied successfully.
- EDI routes and scheduler command registered successfully.
- PHP lint passed for the changed backend files.
- Vite production build passed.
- CODECO catalog migration and seeder applied successfully.
- The repository-wide PHPUnit/Pest suite remains blocked by its pre-existing SQLite setup: it attempts to alter `users` before the `users` table exists. This is unrelated to the EDI migrations and should be repaired separately before relying on the full suite.
