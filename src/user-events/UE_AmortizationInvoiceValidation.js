/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 *
 * UE_AmortizationInvoiceValidation
 * ---------------------------------
 * Runs on Invoice beforeSubmit. Lines flagged for deferred revenue must
 * carry a valid service start/end date so the downstream Map/Reduce
 * amortization job (see MR_RevenueAmortizationProcessor) has everything
 * it needs to build a schedule. Invalid lines are blocked at save time
 * rather than discovered later in the recognition run.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase.
 */
define(['N/record', 'N/error', 'N/log'], (record, error, log) => {

    const DEFERRED_REVENUE_FLAG = 'custcol_defer_revenue';
    const SERVICE_START_FIELD = 'custcol_service_start_date';
    const SERVICE_END_FIELD = 'custcol_service_end_date';

    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
            return;
        }

        const invoice = context.newRecord;
        const lineCount = invoice.getLineCount({ sublistId: 'item' });
        const invalidLines = [];

        for (let line = 0; line < lineCount; line += 1) {
            const isDeferred = invoice.getSublistValue({ sublistId: 'item', fieldId: DEFERRED_REVENUE_FLAG, line });
            if (!isDeferred) {
                continue;
            }

            const startDate = invoice.getSublistValue({ sublistId: 'item', fieldId: SERVICE_START_FIELD, line });
            const endDate = invoice.getSublistValue({ sublistId: 'item', fieldId: SERVICE_END_FIELD, line });

            if (!startDate || !endDate || new Date(endDate) <= new Date(startDate)) {
                invalidLines.push(line + 1);
            }
        }

        if (invalidLines.length > 0) {
            log.error({
                title: 'Amortization validation failed',
                details: `Invoice has invalid service period on line(s): ${invalidLines.join(', ')}`
            });

            throw error.create({
                name: 'INVALID_AMORTIZATION_PERIOD',
                message: `Line(s) ${invalidLines.join(', ')} are flagged for deferred revenue but are missing a valid service start/end date.`,
                notifyOff: false
            });
        }
    }

    return { beforeSubmit };
});
