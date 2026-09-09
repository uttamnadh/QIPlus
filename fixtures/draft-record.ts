import { buildDraftIdentity, SuiteName, DraftIdentity } from './test-data';

/**
 * Setup helper to retrieve or initialize run-scoped draft record metadata.
 * Logs the generated run-scoped Trade Name and TRN for absolute traceability.
 */
export function setupDraftRecord(suiteName: SuiteName): DraftIdentity {
  const identity = buildDraftIdentity(suiteName);
  console.log(`[${suiteName.toUpperCase()} Suite] Initializing run-scoped record: ${identity.tradeName} (TRN: ${identity.trn}, Licence: ${identity.licenceNumber})`);
  return identity;
}
