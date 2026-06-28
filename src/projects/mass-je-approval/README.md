# Mass JE Approval

A real custom mass-approval workflow: an approver searches for journal
entries pending approval, marks the ones to approve, and the batch is
processed asynchronously with a dedicated progress/results page — rather
than generic per-script-type samples, this is one connected mini-project.

## Flow

1. **Access check** — both Suitelets gate on the "Approve Journal Entries"
   permission; a user without it gets an access-denied page instead of the
   search form or results.
2. **SL_MassJEApproval** — search/filter Suitelet. Filters: Date From/To,
   Subsidiary, Name, Page Size. The Subsidiary dropdown is built from the
   user's role: if the role has Subsidiary Restrictions configured, only
   those subsidiaries are offered (and enforced server-side even if the
   request is tampered with); otherwise all active subsidiaries are.
   Always-on rules (not user-facing toggles): only JEs with Approval
   Status = Pending, in an open/unlocked period, and excluding JEs created
   by the logged-in user (segregation of duties). The sublist shows
   Internal ID, Name, Subsidiary, Business Process, Memo, Period, and
   Status (always "Pending Approval"), with native Mark All / Unmark All
   via `sublist.addMarkAllButtons()`. Search is the native submit button;
   Reset and Approve are custom buttons handled by **CS_MassJEApproval**.
3. On Approve, the Suitelet hands the marked ids to **MR_MassJEApprovalProcessor**
   via `N/task` (so a batch of any size is safe from Suitelet
   governance/timeout) and redirects to **SL_MassJEApprovalResults** with
   the task and batch id.
4. **MR_MassJEApprovalProcessor** sets each JE's Approval Status to
   Approved and caches the outcome per JE, keyed by batch id.
5. **SL_MassJEApprovalResults** polls the task status: while it's still
   running, the page auto-refreshes every 5 seconds; once complete, it
   lists each JE with its ID, name, status, and a View link back to the
   record.

## Files

| File | Script Type | Role |
|---|---|---|
| [`SL_MassJEApproval.js`](SL_MassJEApproval.js) | Suitelet | Search/filter page, kicks off the approval batch |
| [`CS_MassJEApproval.js`](CS_MassJEApproval.js) | Client Script | Reset and Approve button behavior |
| [`MR_MassJEApprovalProcessor.js`](MR_MassJEApprovalProcessor.js) | Map/Reduce | Approves each JE, caches per-batch results |
| [`SL_MassJEApprovalResults.js`](SL_MassJEApprovalResults.js) | Suitelet | Progress polling + results page |

Reference/illustrative implementation written to demonstrate the pattern —
not derived from any employer or client codebase. Field/script/deployment
ids are representative placeholders, not real configuration.
