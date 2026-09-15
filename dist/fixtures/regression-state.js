"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveRegressionRecord = saveRegressionRecord;
exports.saveRegressionState = saveRegressionState;
exports.loadRegressionState = loadRegressionState;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const REGRESSION_STATE_FILE = path.join(__dirname, 'regression-state.json');
function saveRegressionRecord(record) {
    const state = loadRegressionState();
    const existingIdx = state.records.findIndex(r => (record.mrn && r.mrn === record.mrn) || r.shareholderType === record.shareholderType);
    if (existingIdx >= 0) {
        state.records[existingIdx] = { ...state.records[existingIdx], ...record };
    }
    else {
        state.records.push(record);
    }
    state.mrn = record.mrn || state.mrn;
    fs.writeFileSync(REGRESSION_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}
function saveRegressionState(data) {
    let state = loadRegressionState();
    state = { ...state, ...data };
    fs.writeFileSync(REGRESSION_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}
function loadRegressionState() {
    try {
        if (fs.existsSync(REGRESSION_STATE_FILE)) {
            const content = fs.readFileSync(REGRESSION_STATE_FILE, 'utf-8');
            const parsed = JSON.parse(content);
            return {
                mrn: parsed.mrn || '',
                records: Array.isArray(parsed.records) ? parsed.records : (parsed.mrn ? [{ mrn: parsed.mrn, tradeName: '', legalName: '', shareholderType: 'Individual' }] : []),
            };
        }
    }
    catch { }
    return { mrn: '', records: [] };
}
