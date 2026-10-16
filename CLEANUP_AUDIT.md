# Repository Cleanup Audit

## Scope and Baseline

- Started with a clean Git working tree on `main`.
- Inventoried and SHA-256 scanned 332 non-generated, non-environment files, including 304 TypeScript/JavaScript source and configuration files. This includes untracked OS metadata; it is not a claim that every business rule was manually reviewed.
- Excluded `.git`, `node_modules`, `.next`, environment files, and TypeScript incremental caches from the content scan. Environment values were not read or printed.
- npm with `package-lock.json`; installed Next.js 16.4.0, React 19.2.4, strict TypeScript with bundler resolution and `@/*` mapped to the repository root.
- App Router only: `app/page.tsx`, `app/layout.tsx`, `(app)` route group, dynamic API segments, and root `proxy.ts`. No Pages Router tree. Read the installed Next.js project-structure guide before editing.
- Feature code follows page/components/hooks/apicall/utils organization. Shared client components and hooks are under `app/components` and `app/hooks`; server utilities and models are under `lib` and `models`.
- Tailwind 4 uses the PostCSS plugin; ESLint uses Next.js core-web-vitals and TypeScript rules. Vitest runs three Node-environment suites.
- Baseline: `npm run typecheck` passed; `npm run test:run` passed (3 files, 28 tests); `npm run build` passed with App Router routes and Proxy. `npm run lint` failed on one existing `react-hooks/set-state-in-effect` error in `app/(app)/employees/components/EmployeeFormDrawer.tsx:97`.
- Git history contains `140d368` (Removed unwanted code) and `7805188` (Initial commit); history alone was not used as evidence for deletion.

## Confirmed Findings and Proposed Cleanup

| Paths | Evidence | Confidence | Action |
| --- | --- | --- | --- |
| Root `components/` except `UnsavedChangesGuard.tsx` | SHA-256 identical to corresponding `app/components/` files; TypeScript-resolved import graph has no incoming references from active application, libraries, or scripts. Root icons only reference other inactive root icons. No `@/components` imports anywhere. | High | Delete inactive copies; retain active `app/components/` unchanged. |
| Root `components/UnsavedChangesGuard.tsx` | Diverges from active implementation, but is not imported and is not a framework entry point. | High | Delete inactive implementation, without merging behavior. |
| Root `hooks/useDrawerClose.ts`, `hooks/useToast.ts` | Exact copies of active hooks; no incoming references or `@/hooks` imports. | High | Delete root copies. |
| Root `layout.tsx`, `page.tsx`, `globals.css`, `select-store/page.tsx` | Exact copies of active App Router files. Root pages outside `app`/`pages` are not routes; no active imports reference these copies. | High | Delete inactive copies; retain App Router metadata, providers, redirects, and CSS. |
| Root `login/apicall/login.ts`, `login/utils/login.ts` | Exact copies; referenced only by the inactive root login tree. | High | Delete copies with their inactive tree. |
| Root `login/page.tsx`, `login/components/LoginScreen.tsx`, `login/components/OtpScreen.tsx`, `login/hooks/useLogin.ts` | Not routed or imported by active code. Root login has a demo OTP flow; active login instead performs a server authentication redirect and uses its own hook. | High | Delete inactive tree; do not transfer demo OTP logic or change active authentication. |
| Root `docs/page.tsx` | Differs from `app/docs/page.tsx`, but is neither an App Router entry point nor referenced by active code. | High | Delete inactive page; retain routed documentation page. |

Static analysis uses the installed TypeScript parser and resolver for imports, re-exports, and literal dynamic/require calls. Repository-wide literal path searches supplement the graph. Framework files are classified using Next.js conventions, not incoming-import counts alone.

## Retained or Requiring Review

| Paths or Category | Evidence and Risk | Confidence / Action |
| --- | --- | --- |
| `app/favicon.ico`, root `favicon.ico` | Exact binary copies. The App Router icon is conventionally discovered; root copy is not routed. | Retain both in this text-only cleanup; root binary can be reviewed separately. |
| Eight feature `hooks/index.ts` files | Inspection confirmed all eight were completely empty, with no incoming references or framework role. | Removed empty placeholders; distinct feature folders remain where populated. |
| `lib/inventory-api.ts` | Inspection confirmed only re-exports of existing utilities, with no consumers or executable entry point. Canonical utility modules remain. | Removed unused internal compatibility barrel. |
| `lib/auth.ts`, `lib/api-auth.ts`, `lib/user-permissions.ts`, `proxy.ts` | JWT route gating and server-side authentication/store authorization serve different boundaries. Similar checks are not evidence of equivalent contracts. | Retain security layers. |
| `lib/mongodb.ts`, `lib/inventory-db.ts` | Separate database access abstractions may serve different collections and connection contracts. | Retain; do not merge by naming similarity. |
| API handlers, request helpers, feature types and validation | Similar shapes can differ in permissions, status codes, tenant scopes, defaults, or error handling. | Retain unless exact behavioral equivalence is established. |
| `scripts/`, spreadsheets, seed/backfill/migration scripts, presentation generator and output | npm scripts and manual/external invocation are valid entry points. | Retain operational artifacts; do not run scripts against the database. |
| `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | No literal source references found, but public URLs can be consumed externally. | Retain pending external URL confirmation. |
| Testing Library packages, `@types/jest`, `ts-node` | No source usage found outside package metadata/historical notes. Ambient test types and optional tooling can be consumed indirectly. | Report as dependency-review candidates, not automatic removals. No upgrades approved or performed. |
| CSS selectors, public assets, exported utilities | Utility classes, computed strings, barrel exports, and external URLs complicate reachability. | No broad CSS/asset/export pruning based only on string counts. |
| Generated files and caches | Builds/typechecking can update `next-env.d.ts` and incremental caches. | Do not delete framework-generated files or change TypeScript settings to hide findings. |

## Verification and Limits

### Additional Duplicate-Logic Findings

- Consolidated identical date enumeration in `app/(app)/attendance/utils/index.ts` and `app/api/salary/route.ts` into existing `lib/date-utils.ts:datesBetween`. Attendance retains its public `enumerateDates` export via an alias; salary retains its local name via an import alias. Function bodies and local-date formatting were verified equivalent before replacement. No new runtime abstraction was introduced.
- Retained repeated `currentMonthRange` implementations in dashboard hooks/API, sales utilities, and withdrawals utilities. These are a possible subsequent consolidation, not part of the verified date-enumeration change.
- Retained `authorizeStore` copies in advances, extra-days, incentives, salary, P&L, and store configuration routes. The body scan identified repeated code, but consolidating security-sensitive call paths deserves dedicated permission and API tests, which are absent here.
- Retained identical withdrawal `validatePayload` functions in `app/api/withdrawals/route.ts` and `app/api/withdrawals/[id]/route.ts`. Candidate for a separately tested shared schema; no validation contract changed in this cleanup.
- Retained feature request wrappers and route/layout wrappers: they provide established feature ownership and framework entry points. Not every small wrapper is accidental duplication.
- No temporary application `console.log`, `console.debug`, or `debugger` statement was identified by the source scan. `lib/audit-log.ts` intentionally emits audit events and was retained. Operational script logging was retained.
- A stricter unused-declaration check reported only the unused `request` parameter at `app/api/users/[id]/route.ts:32`. The route signature was retained. It reported no unused imports or locals in remaining source.

### Change Inventory

- Deleted 65 files: 50 byte-identical copies of retained App Router files, 6 other unreachable root UI files, 8 empty feature hook barrels, and 1 unused inventory re-export barrel.
- The 50 exact copies comprise 42 root component/icon files, 2 root hooks, 4 root page/layout/CSS/store-selection files, and 2 root login API/validation files. Canonical counterparts are at the same paths prefixed with `app/`.
- The 6 other root UI deletions are `components/UnsavedChangesGuard.tsx`, `docs/page.tsx`, `login/page.tsx`, `login/components/LoginScreen.tsx`, `login/components/OtpScreen.tsx`, and `login/hooks/useLogin.ts`.
- The 8 empty hook barrels belonged to employees, inventory, profile, salary, sales, store-config, stores, and users under `app/(app)/`.
- Modified only 2 active source files: `app/(app)/attendance/utils/index.ts` and `app/api/salary/route.ts`.
- Created `lib/date-utils.test.ts` (4 focused tests) and this report. No files moved.
- Removed no npm dependencies, public assets, database artifacts, environment variables, or configuration settings. Package manifest and lockfile are unchanged.
- Tracked `.DS_Store`, `tsconfig.tsbuildinfo`, and `next-env.d.ts` changed during the audit/build workflow. They were not manually edited or reverted and are separate from the intended source cleanup.

### Commands and Results

| Check | Before | After |
| --- | --- | --- |
| `npm run typecheck` | Passed | Passed, including an immediate check after root-tree removal |
| `npm run test:run` | 3 suites / 28 tests passed | 4 suites / 32 tests passed |
| `npm run lint` | Failed: employee-form effect error | Failed: same single error, no new warnings/errors |
| `npm run build` | Passed, Next.js 16.4.0 | Passed; route list and Proxy presence unchanged |
| `TZ=Asia/Kolkata npm run test:run -- lib/date-utils.test.ts` | Not applicable | 4 tests passed |
| `TZ=America/New_York npm run test:run -- lib/date-utils.test.ts` | Not applicable | 4 tests passed |
| `tsc --noEmit --noUnusedLocals --noUnusedParameters --incremental false` | Not a baseline gate | One unused existing route parameter; configuration unchanged |
| `git diff --check` | Not applicable | Passed |
| TypeScript-resolved local import/export scan | Confirmed inactive root trees | 577 references checked, no unresolved local code imports |
| Editor diagnostics | Not captured before cleanup | No errors reported |

Other read-only audit operations: file inventory and SHA-256 grouping; TypeScript AST function-body comparison; literal path, dependency, and asset reference searches; Git status/log and scoped diff/stat inspection; installed framework documentation and configuration reads. An initial `rg` inventory attempt could not run because `rg` is unavailable; Node/editor searches were used instead. Cancelled inspection commands made no edits.

### Residual Risks

No database-backed integration or browser suite is configured in the package scripts, and none was added or executed. Passing utility tests and the production build does not establish full authenticated workflow coverage. Existing lint failure remains visible and was not suppressed. Public URLs, manually invoked tooling, indirect dependency consumers, and potential further business-logic consolidation remain review items. This is a repository-wide inventory/static audit with targeted manual review, not a proof that every remaining export or CSS selector is necessary.

The cleanup removes parallel inactive UI trees that could otherwise attract accidental edits, while preserving the routed implementation, security boundaries, operational tooling, and public route set.

## Shared-Code Refactoring Follow-Up

This follow-up preserves all existing cleanup changes. Next.js, strict TypeScript, npm scripts, feature organization, and module aliases remain as described above.

### Stage A: Opportunities

| Category | Affected Files / Evidence | Proposed Module and Benefit |
| --- | --- | --- |
| Shared date utilities | Identical `currentMonthRange` in dashboard hook/API, sales utilities, withdrawals utilities | Extend existing `lib/date-utils.ts`; one local-calendar implementation for client and server, retaining feature exports. |
| Validation and types | Identical `WithdrawalPayload` and `validatePayload` in withdrawal collection and item handlers | Focused pure withdrawal validation module, following `lib/sales/validation.ts`; preserve validation order, accepted inputs, normalization, and error strings. |
| API / backend services | Repeated role/store authorization functions across salary, advances, incentives, extra-days, P&L and store configuration | Inspect existing `lib/api-auth.ts` before extracting; preserve ObjectId semantics, database access, permission checks and HTTP errors. |
| Reusable frontend behavior | Feature `apicall` wrappers and existing client/session helpers | Inspect the owning fetch implementation first; retain wrappers when they communicate feature boundaries or already delegate shared behavior. |
| Business logic and performance | Similar query/data transformation code spans distinct domains | Do not merge unless contracts match; no speculative caching, memoization or query changes. No runtime speedup claimed for code deduplication alone. |
| Components, styles, configuration | Shared components, design tokens, types and providers already exist | Preserve UI markup, accessibility and client/server boundaries; no broad folder reorganization or new state-management framework. |

Verification will use focused tests for each extraction, followed by typecheck, lint, the test suite, production build, resolved-import/cycle checks, and a scoped diff review. The known pre-existing employee-form lint error remains outside this refactoring.

### Stage B: Completed Refactoring

| Common Code | Canonical Module | Consumers Updated |
| --- | --- | --- |
| Four matching current-month range functions | Added `currentMonthRange` to existing `lib/date-utils.ts` | `app/(app)/dashboard/hooks/useDashboardData.ts`, `app/(app)/sales/utils/index.ts`, `app/(app)/withdrawals/utils/index.ts`, `app/api/dashboard/route.ts` |
| Two withdrawal payload interfaces and validators | New pure `lib/withdrawals/validation.ts`, following the existing domain validation pattern and reusing `WithdrawalRecord` through a type-only import | `app/api/withdrawals/route.ts`, `app/api/withdrawals/[id]/route.ts` |
| Thirteen franchise-admin store authorization functions | Reused existing `lib/api-auth.ts:getAuthorizedStoreAdminId`, without modifying the canonical helper | Advances, extra-days, and incentives collection/item handlers; P&L collection/input handlers; salary collection/slip handlers; store branding/cycle/logo handlers |

- Removed 19 local function implementations, replacing them with shared imports or compatibility re-exports. Four month-range copies now have one canonical implementation; two withdrawal validators now have one; thirteen authorization copies now use an existing helper.
- Existing sales/withdrawals `currentMonthRange` exports remain available, so frontend callers keep their imports. No UI markup, hooks' state behavior, event handling, accessibility, or client directives changed.
- Withdrawal payload validation preserves regex-only dates (including the prior acceptance of calendar-invalid but correctly formatted dates), positive finite amounts, allowed types, reason trimming/default/length rules, error messages, and error precedence.
- Authorization retains franchise-admin-only access, ObjectId validation, assigned-store membership, failure propagation, and record-derived store identity on item routes. Database queries, connection timing, CSRF checks, status codes and response bodies remain in the route handlers.
- Removed now-unused `mongoose` imports from P&L inputs, salary, store branding, and store cycle routes. Other database imports remain where used.
- Extended existing `lib/date-utils.test.ts` with 4 month-boundary cases. Added `lib/withdrawals/validation.test.ts` (11 cases) and `lib/api-auth.test.ts` (13 cases). Permission tests mock the lookup; they do not access a database.
- No additional source files were deleted in this follow-up. Prior cleanup deletions and all unrelated working-tree changes were preserved. No dependencies, configuration, environment values, schemas, or transaction semantics were changed.

### Frontend, Performance and Boundaries

- Shared local-calendar calculation is safe for both browser and server imports: `lib/date-utils.ts` has no server/browser-only dependencies.
- The new withdrawal validator is pure and imports the domain record only with `import type`; it does not export database clients or privileged configuration.
- Existing authorization code remains in its server API module. No client-facing barrel exports server functionality.
- Feature request wrappers mostly delegate directly to native `fetch`. Withdrawal requests uniquely default to `cache: "no-store"` with caller overrides preserved; login retains its custom JSON/error handling. These wrappers were retained instead of adding an unnecessary generic forwarding layer.
- No memoization, caching, request batching, redundant-query removal, state-management changes, or runtime performance improvement is claimed. The demonstrated benefit is fewer independently maintained rules and less coupling through duplicate implementations; no profiling was performed.

### Stage C: Final Verification

| Command / Check | Actual Result |
| --- | --- |
| `npm run typecheck` | Passed after each integration and at completion |
| `npm run test:run` | Passed: 6 suites / 60 tests, including 28 new cases in this follow-up |
| `npm run test:run -- lib/withdrawals/validation.test.ts` | Passed: 11 tests |
| `npm run test:run -- lib/api-auth.test.ts` | Passed before and after route replacement: 13 tests |
| `TZ=Asia/Kolkata npm run test:run -- lib/date-utils.test.ts` | Passed: 8 date tests |
| `TZ=America/New_York npm run test:run -- lib/date-utils.test.ts` | Passed: 8 date tests |
| `npm run lint` | Same pre-existing employee-form effect error; final run has zero warnings. Four intermediate unused-import warnings introduced by extraction were fixed and the check rerun. |
| `tsc --noEmit --noUnusedLocals --noUnusedParameters --incremental false` | Final result: only pre-existing unused `request` at `app/api/users/[id]/route.ts:32` |
| `npm run build` | Passed on Next.js 16.4.0; route list and Proxy presence unchanged |
| `git diff --check` and active refactoring diff review | Passed whitespace check; changes limited to documented extractions/imports and preserved prior cleanup |
| TypeScript AST/resolver graph scan | 243 source/config/test files, 588 local references; no unresolved local imports or detected runtime cycles |
| Transitive client dependency scan | 52 client entry points; no detected database, Node API, `next/headers`, `server-only`, or private environment dependency reachable through local runtime imports |
| HTTP handler comparison against Git HEAD, normalizing only the intended helper substitutions | 29 handlers across 16 route files; no unexpected body differences |
| Editor diagnostics | No errors reported |

The module graph scan excludes type-only edges and third-party internals; it is a static check, not a permanent enforcement mechanism or a proof about nonliteral runtime imports. The production build provides an additional framework boundary check.

### Remaining Opportunities and Risks

- Similar today/week range helpers and locale formatting may be consolidated later, with attention to Sunday/Monday week starts and different precision/format requirements.
- Inventory authorization has a similar role/store rule but returns a boolean and belongs to its own data-access boundary. It was retained; no extra compatibility wrapper was introduced solely to reduce lines.
- More substantial component/hook, form, query, or service consolidation needs dedicated behavioral coverage and, for performance work, profiling. Similar domain models are not interchangeable solely because their handlers look alike.
- Existing lint and unused-parameter findings remain visible. No checks were weakened or errors suppressed.
- No browser, database-backed integration, or authenticated end-to-end tests were executed. Security helper tests cover decisions with mocked membership data; live database behavior remains unverified.
- The earlier cleanup sections describe their original stage outcomes; this follow-up supersedes their deferred status for month ranges, withdrawal payload validation, and the 13 extracted authorization functions.