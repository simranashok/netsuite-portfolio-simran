/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 *
 * CS_MassJEApproval
 * --------------------
 * Client-side behavior for SL_MassJEApproval's search/filter page: the
 * Reset and Approve buttons. Mark All / Unmark All are handled natively
 * by the sublist's addMarkAllButtons(), so no client script is needed for
 * those. The Suitelet only has one native submit button (Search), so
 * Reset and Approve are custom buttons that set a hidden action flag and
 * submit the form themselves rather than each needing a server round
 * trip just to know which button was clicked. A successful Approve
 * redirects server-side to SL_MassJEApprovalResults for progress/results.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase.
 */
define(['N/currentRecord'], (currentRecord) => {

    const SUBLIST_ID = 'pendingje';
    const MARK_FIELD_ID = 'mark';
    const ACTION_FIELD_ID = 'custpage_action';
    const FILTER_FIELD_IDS = ['custpage_datefrom', 'custpage_dateto', 'custpage_subsidiary', 'custpage_name'];

    function triggerReset() {
        const rec = currentRecord.get();
        FILTER_FIELD_IDS.forEach((fieldId) => rec.setValue({ fieldId, value: '' }));
        submitWithAction('reset');
    }

    function triggerApprove() {
        const rec = currentRecord.get();
        const lineCount = rec.getLineCount({ sublistId: SUBLIST_ID });
        let anyMarked = false;

        for (let line = 0; line < lineCount; line += 1) {
            if (rec.getSublistValue({ sublistId: SUBLIST_ID, fieldId: MARK_FIELD_ID, line })) {
                anyMarked = true;
                break;
            }
        }

        if (!anyMarked) {
            alert('Select at least one journal entry before approving.');
            return;
        }

        submitWithAction('approve');
    }

    function submitWithAction(action) {
        const rec = currentRecord.get();
        rec.setValue({ fieldId: ACTION_FIELD_ID, value: action });
        document.forms[0].submit();
    }

    return { triggerReset, triggerApprove };
});
