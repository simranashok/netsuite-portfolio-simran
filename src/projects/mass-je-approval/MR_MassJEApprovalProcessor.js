/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 *
 * MR_MassJEApprovalProcessor
 * -----------------------------
 * Does the actual approval work for the Mass JE Approval project. Triggered
 * via N/task from SL_MassJEApproval's POST handler instead of approving
 * inline in the Suitelet, so a batch of any size is safe from Suitelet
 * governance/timeout limits. Each JE is an independent update with nothing
 * to aggregate across records, so this intentionally skips the reduce
 * stage — map + summarize is the right shape here, not a 4-stage pattern
 * for its own sake.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase.
 */
define(['N/record', 'N/cache', 'N/runtime', 'N/search', 'N/log'], (record, cache, runtime, search, log) => {

    const APPROVAL_STATUS_APPROVED = '2'; // NetSuite's standard Approval Status list value for "Approved"
    const CACHE_NAME = 'mass_je_approval';

    function getInputData() {
        const script = runtime.getCurrentScript();
        const ids = (script.getParameter({ name: 'custscript_mjea_je_ids' }) || '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);

        return ids;
    }

    function map(context) {
        const journalEntryId = context.value;

        try {
            record.submitFields({
                type: record.Type.JOURNAL_ENTRY,
                id: journalEntryId,
                values: { approvalstatus: APPROVAL_STATUS_APPROVED }
            });

            context.write({ key: journalEntryId, value: 'approved' });
        } catch (e) {
            log.error({ title: `Failed to approve JE ${journalEntryId}`, details: e });
            context.write({ key: journalEntryId, value: `error: ${e.message}` });
        }
    }

    function summarize(summary) {
        const script = runtime.getCurrentScript();
        const batchId = script.getParameter({ name: 'custscript_mjea_batch_id' });

        const results = [];
        summary.output.iterator().each((journalEntryId, outcome) => {
            results.push({
                id: journalEntryId,
                tranid: lookupTranId(journalEntryId),
                status: outcome
            });
            return true;
        });

        let mapErrors = 0;
        summary.mapSummary.errors.iterator().each((key, error) => {
            mapErrors += 1;
            log.error({ title: `Map error on JE ${key}`, details: error });
            return true;
        });

        const cacheInstance = cache.getCache({ name: CACHE_NAME, scope: cache.Scope.PROTECTED });
        cacheInstance.put({
            key: `results_${batchId}`,
            value: JSON.stringify(results),
            ttl: 3600
        });

        log.audit({
            title: 'MR_MassJEApprovalProcessor summary',
            details: `Batch ${batchId}: ${results.length} processed, ${mapErrors} map errors, usage ${summary.usage}`
        });
    }

    function lookupTranId(journalEntryId) {
        try {
            return search.lookupFields({
                type: search.Type.JOURNAL_ENTRY,
                id: journalEntryId,
                columns: ['tranid']
            }).tranid;
        } catch (e) {
            return null;
        }
    }

    return { getInputData, map, summarize };
});
