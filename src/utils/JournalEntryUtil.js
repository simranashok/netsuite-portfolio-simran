/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 *
 * JournalEntryUtil
 * ----------------
 * Shared library module for creating standard and amortization journal
 * entries. Consumed by MR_RevenueAmortizationProcessor and
 * UE_AmortizationInvoiceValidation so that journal-entry construction
 * logic lives in exactly one place instead of being duplicated per script.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase.
 */
define(['N/record', 'N/format', 'N/log'], (record, format, log) => {

    /**
     * Creates a standard (non-amortizing) journal entry.
     *
     * @param {Object} options
     * @param {string} options.subsidiaryId
     * @param {string} options.memo
     * @param {Date}   options.trandate
     * @param {Array<{account: string, debit?: number, credit?: number, entity?: string, memo?: string}>} options.lines
     * @returns {number} internal id of the created journal entry
     */
    function createStandardJournalEntry(options) {
        validateLines(options.lines);

        const je = record.create({ type: record.Type.JOURNAL_ENTRY, isDynamic: true });

        je.setValue({ fieldId: 'subsidiary', value: options.subsidiaryId });
        je.setValue({ fieldId: 'trandate', value: options.trandate || new Date() });
        je.setValue({ fieldId: 'memo', value: options.memo || '' });

        options.lines.forEach((line) => {
            je.selectNewLine({ sublistId: 'line' });
            je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'account', value: line.account });
            if (line.debit) {
                je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'debit', value: line.debit });
            }
            if (line.credit) {
                je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'credit', value: line.credit });
            }
            if (line.entity) {
                je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'entity', value: line.entity });
            }
            if (line.memo) {
                je.setCurrentSublistValue({ sublistId: 'line', fieldId: 'memo', value: line.memo });
            }
            je.commitLine({ sublistId: 'line' });
        });

        const id = je.save({ enableSourcing: true, ignoreMandatoryFields: false });
        log.audit({ title: 'Journal Entry Created', details: `JE #${id}` });
        return id;
    }

    /**
     * Creates a set of monthly amortization journal entries for a deferred
     * revenue or expense amount, split evenly across the recognition period.
     *
     * @param {Object} options
     * @param {string} options.subsidiaryId
     * @param {string} options.deferredAccount   account currently holding the unrecognized balance
     * @param {string} options.recognitionAccount account to recognize revenue/expense into
     * @param {number} options.totalAmount
     * @param {Date}   options.startDate
     * @param {number} options.numberOfPeriods
     * @param {string} [options.memoPrefix]
     * @returns {number[]} internal ids of the created journal entries
     */
    function createAmortizationJournalEntries(options) {
        const {
            subsidiaryId, deferredAccount, recognitionAccount,
            totalAmount, startDate, numberOfPeriods, memoPrefix
        } = options;

        if (!numberOfPeriods || numberOfPeriods < 1) {
            throw new Error('numberOfPeriods must be a positive integer');
        }

        const periodAmount = roundToCents(totalAmount / numberOfPeriods);
        const lastPeriodAmount = roundToCents(totalAmount - periodAmount * (numberOfPeriods - 1));
        const createdIds = [];

        for (let i = 0; i < numberOfPeriods; i += 1) {
            const periodDate = addMonths(startDate, i);
            const amount = i === numberOfPeriods - 1 ? lastPeriodAmount : periodAmount;
            const memo = `${memoPrefix || 'Amortization'} - period ${i + 1} of ${numberOfPeriods} (${format.format({ value: periodDate, type: format.Type.DATE })})`;

            const id = createStandardJournalEntry({
                subsidiaryId,
                trandate: periodDate,
                memo,
                lines: [
                    { account: deferredAccount, debit: amount, memo },
                    { account: recognitionAccount, credit: amount, memo }
                ]
            });

            createdIds.push(id);
        }

        return createdIds;
    }

    function validateLines(lines) {
        if (!Array.isArray(lines) || lines.length < 2) {
            throw new Error('Journal entry requires at least two lines');
        }
        const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
        const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
        if (roundToCents(totalDebit) !== roundToCents(totalCredit)) {
            throw new Error(`Journal entry is out of balance: debit ${totalDebit} vs credit ${totalCredit}`);
        }
    }

    function roundToCents(value) {
        return Math.round(value * 100) / 100;
    }

    function addMonths(date, months) {
        const result = new Date(date);
        result.setMonth(result.getMonth() + months);
        return result;
    }

    return {
        createStandardJournalEntry,
        createAmortizationJournalEntries
    };
});
