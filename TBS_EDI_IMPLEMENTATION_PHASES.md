# TBS EDI Implementation Phases (Laravel)

## Goal
Build a standalone EDI module inside Laravel that reproduces legacy behavior exactly, including:
1. Automatic sending
2. Manual sending from web buttons
3. Per-client formatting and routing differences
4. Send-state tracking to prevent duplicates
5. Multi-channel delivery (HTTP, file, email, SFTP)
6. Full legacy client coverage (all clients present in legacy EDI)

## Locked Decisions (Confirmed)
1. Preserve exact payload format per client first.
2. Preserve exact channel per client first.
3. Use queued delivery with retries and dead-letter logging.
4. Use explicit dispatch audit tables for every attempt.
5. Integrate all clients from legacy EDI (no partial client scope).

## Guiding Rule
Legacy behavior parity first, modernization second.

## Phase 0 - Freeze Legacy Behavior
### Scope
Capture exact source behavior before coding.

### Inputs
1. Legacy CSP and exported routines (already available)
2. Legacy PHP exporters (already available)
3. Legacy VBS trigger scripts (already available)

### Deliverables
1. Client-by-client behavior matrix
2. Trigger map (manual, auto, interval)
3. Payload specification per client
4. Delivery channel map per client

### Exit Criteria
1. No unknown fields in any client payload
2. No unknown send path for any go-live client

## Phase 1 - EDI Module Foundation
### Scope
Create isolated EDI module in Laravel without touching existing non-EDI flows.

### Components
1. EDI config file
2. EDI database tables
3. EDI service interfaces
4. EDI logging and audit base
5. EDI feature flags

### Database Tables
1. edi_profiles
2. edi_profile_fields
3. edi_dispatch_batches
4. edi_dispatch_records
5. edi_dispatch_attempts
6. edi_outbound_artifacts

### Exit Criteria
1. Migrations applied successfully
2. Basic profile CRUD works
3. Dispatch log can store a full send attempt lifecycle

## Phase 2 - Data Extraction and Formatting Parity
### Scope
Implement exact payload generation per client.

### Rules to Preserve
1. Field ordering
2. Delimiters and line endings
3. Terminator (ENDRECORD or END OF FILE)
4. Optional extra field behavior (example: class)
5. Record filters and limits
6. Legacy string cleanup logic (remarks line-break stripping)

### Deliverables
1. EdiQueryService
2. EdiFormatterService
3. Golden sample output artifacts per client

### Exit Criteria
1. Generated payload diff matches legacy for test data
2. No schema mismatch for mapped fields

## Phase 3 - Delivery Adapters
### Scope
Support each legacy send route as adapter strategies.

### Adapters
1. HttpSenderAdapter
2. FileDropSenderAdapter
3. EmailAttachmentSenderAdapter
4. SftpSenderAdapter

### Required Behaviors
1. Timeout control
2. Retry and backoff
3. Response capture
4. Idempotency guard
5. Post-send artifact archive

### Exit Criteria
1. Each adapter can pass integration tests
2. Failed delivery is fully recorded and retryable

## Phase 4 - Automatic Scheduling
### Scope
Replace legacy browser and VBS triggers with server-side scheduling.

### Jobs and Commands
1. edi:dispatch-auto command
2. Per-profile queued dispatch jobs
3. Retry worker policy

### Legacy Frequency Parity
1. 300-second style cycles for export-like profiles
2. 7200-second style cycles for long-interval profiles
3. Per-profile schedule override

### Exit Criteria
1. Scheduler executes without overlaps
2. Dispatch throughput and timings are stable

## Phase 5 - Manual Operations UI
### Scope
Allow operations team to trigger and verify sends.

### UI Features
1. Client profile list and status
2. Payload preview
3. Send now action
4. Resend action with confirmation
5. Attempt history and error details

### Controls
1. Role-based access
2. Audit logging
3. Kill switch visibility

### Exit Criteria
1. Manual send reproduces auto send output
2. Operator can troubleshoot failures without CLI access

## Phase 6 - Verification and Parallel Run
### Scope
Run old and new in parallel, then cut over safely.

### Validation
1. Payload diff checks
2. Record count checks
3. Duplicate prevention checks
4. Transport success rate checks

### Cutover
1. Enable low-risk client first
2. Monitor
3. Enable next client batches

### Rollback
1. EDI global disable flag
2. Per-client disable flag
3. Job drain and stop procedure

### Exit Criteria
1. Business signoff per client
2. Legacy flow can be retired

## Phase 7 - Hardening and Operations
### Scope
Production reliability and security improvements.

### Tasks
1. Secret management via environment variables
2. Alerting for repeated failures
3. Artifact retention policy
4. Failed queue dashboard
5. Runbook for support team

### Exit Criteria
1. On-call runbook validated
2. Alert thresholds tuned

## Remaining Clarifications Needed Before Coding Starts
1. Final destination details per client:
	HTTP endpoint URL, file-drop path, SMTP recipients, or SFTP host/remote path
2. Credentials and auth per client channel:
	API keys, SMTP auth, SFTP user/key or password, host fingerprints
3. Send schedule per client:
	keep legacy cadence (300-second style or 7200-second style) or provide override
4. Sent-state policy:
	confirm mark-as-sent only after confirmed delivery success
5. Resend policy:
	allowed with reason logging, and whether approval is required
6. Manual send access:
	roles/users allowed to trigger send and resend from Laravel UI
7. Environment mapping:
	which channels are enabled in staging vs production for each client

## Default Assumptions If Not Provided
1. Unsent records only are dispatch candidates
2. Mark sent only after successful delivery
3. Retry backoff: 60s, 300s, 900s
4. Max attempts: 3
5. Auto schedule default: every 5 minutes
6. Storage location: private storage path with timestamped filenames
7. Manual resend is allowed only for admins and always audited

## Implementation Order (Execution Guide)
1. Implement Phase 1 foundation
2. Implement Phase 2 formatter for first two clients
3. Implement Phase 3 adapters needed by those clients
4. Implement Phase 4 scheduler and workers
5. Implement Phase 5 manual UI and audit trail
6. Run Phase 6 parallel validation
7. Roll forward client-by-client

## Notes
1. Existing non-EDI Laravel modules are not modified unless needed for EDI data access.
2. EDI module remains isolated and can be toggled independently.
