import * as os from 'os';
import * as https from 'https';

export interface VpnCheckResult {
  isVpnActive: boolean;
  vpnIp?: string;
  isServerReachable: boolean;
  statusCode?: number;
  errorMessage?: string;
}

/**
 * Checks if the system has an active OpenVPN network adapter / private subnet (172.27.x.x)
 */
export function detectVpnInterface(): { active: boolean; ip?: string; interfaceName?: string } {
  const interfaces = os.networkInterfaces();

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        // OpenVPN private subnet for QiPlus / trueid gateway is 172.27.x.x
        if (addr.address.startsWith('172.27.')) {
          return { active: true, ip: addr.address, interfaceName: name };
        }
        // Check interface name indicators
        if (/openvpn|tap|tun|wintun/i.test(name)) {
          return { active: true, ip: addr.address, interfaceName: name };
        }
      }
    }
  }

  return { active: false };
}

/**
 * Probes the QiPlus UAT portal (https://idms-uat.qiplus.ae) with a fast 3-second timeout
 */
export function probePortalReachability(url = 'https://idms-uat.qiplus.ae', timeoutMs = 3500): Promise<{ reachable: boolean; statusCode?: number; error?: string }> {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      resolve({ reachable: true, statusCode: res.statusCode });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ reachable: false, error: 'Connection Timed Out (3.5s)' });
    });

    req.on('error', (err) => {
      resolve({ reachable: false, error: err.message });
    });
  });
}

/**
 * Complete pre-flight check that validates VPN and server connectivity.
 */
export async function checkVpnAndPortal(): Promise<VpnCheckResult> {
  const vpnInfo = detectVpnInterface();
  const probe = await probePortalReachability();

  return {
    isVpnActive: vpnInfo.active,
    vpnIp: vpnInfo.ip,
    isServerReachable: probe.reachable,
    statusCode: probe.statusCode,
    errorMessage: probe.error,
  };
}
