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
exports.base32Decode = base32Decode;
exports.generateTOTP = generateTOTP;
const crypto = __importStar(require("crypto"));
/**
 * Pure Node.js Base32 decoder (RFC 4648 standard).
 */
function base32Decode(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = '';
    for (let i = 0; i < clean.length; i++) {
        const val = alphabet.indexOf(clean[i]);
        if (val === -1) {
            throw new Error(`Invalid Base32 character encountered: ${clean[i]}`);
        }
        bits += val.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    return Buffer.from(bytes);
}
/**
 * Generate standard 6-digit TOTP (RFC 6238, HMAC-SHA1, 30-second interval).
 * Calculates the exact real-time OTP matching Google/Microsoft Authenticator.
 */
function generateTOTP(secret, timeStepSeconds = 30, digits = 6) {
    if (!secret)
        return '';
    const key = base32Decode(secret);
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / timeStepSeconds);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigInt64BE(BigInt(counter));
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(timeBuffer);
    const hmacResult = hmac.digest();
    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const binary = ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);
    const otp = (binary % Math.pow(10, digits)).toString();
    return otp.padStart(digits, '0');
}
