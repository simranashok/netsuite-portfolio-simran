/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 *
 * MR_RevenueAmortizationProcessor
 * ---------------------------------
 * Full Map/Reduce flow for revenue recognition. Finds invoice lines that
 * were flagged for deferred revenue and validated upstream by
 * UE_AmortizationInvoiceValidation, then generates the monthly
 * amortization journal entries for each one via the shared
 * JournalEntryUtil library — built to run at volume rather than line by
 * line in a scheduled script.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase.
 */
define(
    ['N/search', 'N/record', 'N/log', '../utils/JournalEntryUtil'],
    (search, record, log, journalEntryUtil) => {

        function getInputData() {
            return search.create({
                type: search.Type.INVOICE,
                filters: [
                    ['item.custcol_defer_revenue', 'is', 'T'],
                    'AND',
                    ['custbody_amortization_processed', 'is', 'F']
                ],
                columns: [
                    'internalid',
                    'subsidiary',
                    search.createColumn({ name: 'custcol_service_start_date', join: 'item' }),
                    search.createColumn({ name: 'custcol_service_end_date', join: 'item' }),
                    search.createColumn({ name: 'amount', join: 'item' }),
                    search.createColumn({ name: 'account', join: 'item' }),
                    search.createColumn({ name: 'custcol_revenue_recognition_account', join: 'item' })
                ]
            });
        }

        function map(context) {
            const result = JSON.parse(context.value);
            const invoiceId = result.id;

            context.write({
                key: invoiceId,
                value: {
                    subsidiary: result.values.subsidiary.value,
                    startDate: result.values['custcol_service_start_date.item'],
                    endDate: result.values['custcol_service_end_date.item'],
                    amount: parseFloat(result.values['amount.item']),
                    deferredAccount: result.values['account.item'].value,
                    recognitionAccount: result.values['custcol_revenue_recognition_account.item'].value
                }
            });
        }

        function reduce(context) {
            const invoiceId = context.key;
            const line = JSON.parse(context.values[0]);

            const numberOfPeriods = monthsBetween(line.startDate, line.endDate);
            if (numberOfPeriods < 1) {
                log.error({ title: `Skipping invoice ${invoiceId}`, details: 'Service period resolved to fewer than 1 month' });
                return;
            }

            const createdIds = journalEntryUtil.createAmortizationJournalEntries({
                subsidiaryId: line.subsidiary,
                deferredAccount: line.deferredAccount,
                recognitionAccount: line.recognitionAccount || line.deferredAccount,
                totalAmount: line.amount,
                startDate: new Date(line.startDate),
                numberOfPeriods,
                memoPrefix: `Invoice ${invoiceId} amortization`
            });

            record.submitFields({
                type: record.Type.INVOICE,
                id: invoiceId,
                values: { custbody_amortization_processed: true }
            });

            log.audit({ title: `Amortization complete for invoice ${invoiceId}`, details: `Created ${createdIds.length} journal entries` });
        }

        function summarize(summary) {
            let errorCount = 0;
            summary.mapSummary.errors.iterator().each((key, error) => {
                errorCount += 1;
                log.error({ title: `Map error on key ${key}`, details: error });
                return true;
            });
            summary.reduceSummary.errors.iterator().each((key, error) => {
                errorCount += 1;
                log.error({ title: `Reduce error on key ${key}`, details: error });
                return true;
            });

            log.audit({
                title: 'MR_RevenueAmortizationProcessor summary',
                details: `Usage: ${summary.usage}, Concurrency: ${summary.concurrency}, Yields: ${summary.yields}, Errors: ${errorCount}`
            });
        }

        function monthsBetween(startDate, endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
        }

        return { getInputData, map, reduce, summarize };
    }
);
