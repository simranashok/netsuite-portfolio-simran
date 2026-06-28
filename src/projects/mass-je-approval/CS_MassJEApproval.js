/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 *
 * CS_MassJEApproval
 * --------------------
 * Client-side behavior for SL_MassJEApproval's search/results page: Mark
 * All / Unmark All over the pending-JE sublist, plus the Refresh and
 * Approve buttons. The Suitelet only has one native submit button, so
 * Refresh and Approve are custom buttons that set a hidden action flag
 * and submit the form themselves rather than each needing a server round
 * trip just to know which button was clicked.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase.
 */
define(['N/currentRecord'], (currentRecord) => {

    const SUBLIST_ID = 'pendingje';
    const MARK_FIELD_ID = 'mark';
    const ACTION_FIELD_ID = 'custpage_action';

    function markAll() {
        setAllMarks(true);
    }

    function unmarkAll() {
        setAllMarks(false);
    }

    function triggerRefresh() {
        submitWithAction('refresh');
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

    function setAllMarks(value) {
        const rec = currentRecord.get();
        const lineCount = rec.getLineCount({ sublistId: SUBLIST_ID });

        for (let line = 0; line < lineCount; line += 1) {
            rec.selectLine({ sublistId: SUBLIST_ID, line });
            rec.setCurrentSublistValue({ sublistId: SUBLIST_ID, fieldId: MARK_FIELD_ID, value });
            rec.commitLine({ sublistId: SUBLIST_ID });
        }
    }

    function submitWithAction(action) {
        const rec = currentRecord.get();
        rec.setValue({ fieldId: ACTION_FIELD_ID, value: action });
        document.forms[0].submit();
    }

    return { markAll, unmarkAll, triggerRefresh, triggerApprove };
});
