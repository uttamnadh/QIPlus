import * as fs from 'fs';
import * as path from 'path';

const REGRESSION_STATE_FILE = path.join(__dirname, 'regression-state.json');

export interface MerchantRecordInfo {
  mrn: string;
  tradeName: string;
  legalName: string;
  shareholderType: 'Individual' | 'Entity';
  submitted?: boolean;
  complianceApproved?: boolean;
  finalApproved?: boolean;
}

export interface RegressionState {
  mrn: string;
  complianceApproved?: boolean;
  finalApproved?: boolean;
  auditorVerified?: boolean;
  records: MerchantRecordInfo[];
}

export function saveRegressionRecord(record: MerchantRecordInfo) {
  const state = loadRegressionState();
  const existingIdx = state.records.findIndex(r => (record.mrn && r.mrn === record.mrn) || r.shareholderType === record.shareholderType);
  if (existingIdx >= 0) {
    state.records[existingIdx] = { ...state.records[existingIdx], ...record };
  } else {
    state.records.push(record);
  }
  state.mrn = record.mrn || state.mrn;
  fs.writeFileSync(REGRESSION_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export function saveRegressionState(data: Partial<RegressionState>) {
  let state = loadRegressionState();
  state = { ...state, ...data };
  fs.writeFileSync(REGRESSION_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export function loadRegressionState(): RegressionState {
  try {
    if (fs.existsSync(REGRESSION_STATE_FILE)) {
      const content = fs.readFileSync(REGRESSION_STATE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        mrn: parsed.mrn || '',
        complianceApproved: parsed.complianceApproved,
        finalApproved: parsed.finalApproved,
        records: Array.isArray(parsed.records) ? parsed.records : (parsed.mrn ? [{ mrn: parsed.mrn, tradeName: '', legalName: '', shareholderType: 'Individual' }] : []),
      };
    }
  } catch {}
  return { mrn: '', records: [] };
}
