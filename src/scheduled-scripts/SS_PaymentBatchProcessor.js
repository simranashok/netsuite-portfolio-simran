/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 *
 * SS_PaymentBatchProcessor
 * -------------------------
 * Nightly batch job supporting the payment process: finds open customer
 * invoices that have a payment authorized upstream (e.g. via a payment
 * gateway or bank file) and applies the payment, respecting governance
 * limits by yielding the job rather than letting it hit the usage cap
 * mid-batch.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase.
 */
define(['N/record', 'N/search', 'N/runtime', 'N/log'], (record, search, runtime, log) => {

    const GOVERNANCE_THRESHOLD = 200;

    function execute(context) {
        const readySearch = buildReadyForPaymentSearch();
        let processed = 0;
        let failed = 0;

        readySearch.run().each((result) => {
            if (runtime.getCurrentScript().getRemainingUsage() < GOVERNANCE_THRESHOLD) {
                log.audit({ title: 'Yielding before governance limit', details: `Processed ${processed} so far this run` });
                return false; // stop iterating; scheduler will re-trigger the next deployment cycle
            }

            try {
                applyAuthorizedPayment(result.id, result.getValue({ name: 'custbody_authorized_payment_amount' }));
                processed += 1;
            } catch (e) {
                failed += 1;
                log.error({ title: `Failed to apply payment for invoice ${result.id}`, details: e });
            }

            return true;
        });

        log.audit({ title: 'Payment batch complete', details: `Processed: ${processed}, Failed: ${failed}` });
    }

    function buildReadyForPaymentSearch() {
        return search.create({
            type: search.Type.INVOICE,
            filters: [
                ['status', 'anyof', 'CustInvc:A'], // open invoices
                'AND',
                ['custbody_authorized_payment_amount', 'greaterthan', 0]
            ],
            columns: ['entity', 'custbody_authorized_payment_amount', 'amountremaining']
        });
    }

    function applyAuthorizedPayment(invoiceId, authorizedAmount) {
        const paymentRecord = record.transform({
            fromType: record.Type.INVOICE,
            fromId: invoiceId,
            toType: record.Type.CUSTOMER_PAYMENT,
            isDynamic: true
        });

        const lineCount = paymentRecord.getLineCount({ sublistId: 'apply' });
        for (let line = 0; line < lineCount; line += 1) {
            const apply = paymentRecord.getSublistValue({ sublistId: 'apply', fieldId: 'internalid', line }) === invoiceId;
            if (apply) {
                paymentRecord.selectLine({ sublistId: 'apply', line });
                paymentRecord.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'apply', value: true });
                paymentRecord.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'amount', value: authorizedAmount });
                paymentRecord.commitLine({ sublistId: 'apply' });
                break;
            }
        }

        const paymentId = paymentRecord.save({ enableSourcing: true });
        log.audit({ title: 'Payment applied', details: `Invoice ${invoiceId} -> Payment #${paymentId}` });
        return paymentId;
    }

    return { execute };
});
