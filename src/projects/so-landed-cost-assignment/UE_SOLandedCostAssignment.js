/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 *
 * UE_SOLandedCostAssignment
 * ---------------------------
 * Runs on Sales Order beforeSubmit (create). Chains four checks before
 * touching anything: Subsidiary is Mexico -> Location's country is US ->
 * a Landed Cost Template exists for country US -> for each line, the
 * item's own default Landed Cost Template matches that US template. Only
 * lines that pass all four get the template stamped onto them, so an
 * order with mixed item sourcing doesn't get a blanket assignment.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase.
 */
define(['N/search'], (search) => {

    const MEXICO_SUBSIDIARY_ID = '13'; // representative placeholder subsidiary internal id
    const US_COUNTRY_CODE = 'US';

    const LANDED_COST_TEMPLATE_RECORD_TYPE = 'customrecord_landed_cost_template';
    const LANDED_COST_TEMPLATE_COUNTRY_FIELD = 'custrecord_lct_country';
    const ITEM_LANDED_COST_TEMPLATE_FIELD = 'custitem_landed_cost_template';
    const LINE_LANDED_COST_TEMPLATE_FIELD = 'custcol_landed_cost_template';

    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.CREATE) {
            return;
        }

        const soRecord = context.newRecord;

        if (soRecord.getValue({ fieldId: 'subsidiary' }) !== MEXICO_SUBSIDIARY_ID) {
            return;
        }

        if (!isUSLocation(soRecord.getValue({ fieldId: 'location' }))) {
            return;
        }

        const usTemplateId = findUSLandedCostTemplate();
        if (!usTemplateId) {
            return;
        }

        applyTemplateToMatchingLines(soRecord, usTemplateId);
    }

    function isUSLocation(locationId) {
        if (!locationId) {
            return false;
        }

        const country = search.lookupFields({
            type: search.Type.LOCATION,
            id: locationId,
            columns: ['country']
        }).country;

        return country === US_COUNTRY_CODE;
    }

    function findUSLandedCostTemplate() {
        const results = search.create({
            type: LANDED_COST_TEMPLATE_RECORD_TYPE,
            filters: [[LANDED_COST_TEMPLATE_COUNTRY_FIELD, 'is', US_COUNTRY_CODE]],
            columns: ['internalid']
        }).run().getRange({ start: 0, end: 1 });

        return results.length ? results[0].getValue('internalid') : null;
    }

    function applyTemplateToMatchingLines(soRecord, usTemplateId) {
        const lineCount = soRecord.getLineCount({ sublistId: 'item' });

        for (let line = 0; line < lineCount; line += 1) {
            const itemId = soRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line });
            if (!itemId) {
                continue;
            }

            if (lookupItemLandedCostTemplate(itemId) === usTemplateId) {
                soRecord.setSublistValue({
                    sublistId: 'item',
                    fieldId: LINE_LANDED_COST_TEMPLATE_FIELD,
                    line,
                    value: usTemplateId
                });
            }
        }
    }

    function lookupItemLandedCostTemplate(itemId) {
        const result = search.lookupFields({
            type: search.Type.ITEM,
            id: itemId,
            columns: [ITEM_LANDED_COST_TEMPLATE_FIELD]
        });

        const field = result[ITEM_LANDED_COST_TEMPLATE_FIELD];
        return (field && field.length) ? field[0].value : null;
    }

    return { beforeSubmit };
});
