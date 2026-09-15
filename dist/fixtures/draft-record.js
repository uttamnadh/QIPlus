"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupDraftRecord = setupDraftRecord;
const test_data_1 = require("./test-data");
/**
 * Setup helper to retrieve or initialize run-scoped draft record metadata.
 * Logs the generated run-scoped Trade Name and TRN for absolute traceability.
 */
function setupDraftRecord(suiteName) {
    const identity = (0, test_data_1.buildDraftIdentity)(suiteName);
    console.log(`[${suiteName.toUpperCase()} Suite] Initializing run-scoped record: ${identity.tradeName} (TRN: ${identity.trn}, Licence: ${identity.licenceNumber})`);
    return identity;
}
