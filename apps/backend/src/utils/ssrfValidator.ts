import dns from 'dns/promises';
import { URL } from 'url';

/**
 * Enterprise SSRF (Server-Side Request Forgery) Validator
 * Blocks internal IP spaces, cloud instance metadata (AWS 169.254.169.254, GCP metadata.google.internal),
 * loopbacks, and private RFC-1918 subnets from outbound webhooks and HTTP clients.
 */

// Helper to check if IPv4 is within a CIDR range
function isIpv4InSubnet(ip: string, subnet: string, maskBits: number): boolean {
  const ipParts = ip.split('.').map(Number);
  const subnetParts = subnet.split('.').map(Number);

  if (ipParts.length !== 4 || subnetParts.length !== 4) return false;

  const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const subnetNum = (subnetParts[0] << 24) | (subnetParts[1] << 16) | (subnetParts[2] << 8) | subnetParts[3];
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits));

  return (ipNum & mask) === (subnetNum & mask);
}

export function isPrivateOrReservedIp(ip: string): boolean {
  // Check IPv6 loopback and link-local
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
    return true;
  }

  // IPv4 Checks
  if (isIpv4InSubnet(ip, '127.0.0.0', 8)) return true; // Loopback
  if (isIpv4InSubnet(ip, '10.0.0.0', 8)) return true; // Private RFC 1918 Class A
  if (isIpv4InSubnet(ip, '172.16.0.0', 12)) return true; // Private RFC 1918 Class B
  if (isIpv4InSubnet(ip, '192.168.0.0', 16)) return true; // Private RFC 1918 Class C
  if (isIpv4InSubnet(ip, '169.254.0.0', 16)) return true; // Link-Local & Cloud Metadata (169.254.169.254)
  if (isIpv4InSubnet(ip, '100.64.0.0', 10)) return true; // Carrier-grade NAT
  if (isIpv4InSubnet(ip, '0.0.0.0', 8)) return true; // Current network
  if (isIpv4InSubnet(ip, '192.0.2.0', 24)) return true; // TEST-NET-1
  if (isIpv4InSubnet(ip, '198.51.100.0', 24)) return true; // TEST-NET-2
  if (isIpv4InSubnet(ip, '203.0.113.0', 24)) return true; // TEST-NET-3
  if (isIpv4InSubnet(ip, '224.0.0.0', 4)) return true; // Multicast
  if (isIpv4InSubnet(ip, '240.0.0.0', 4)) return true; // Reserved
  if (ip === '255.255.255.255') return true; // Broadcast

  return false;
}

export async function validateWebhookUrl(rawUrl: string, isProduction: boolean = process.env.NODE_ENV === 'production'): Promise<{ valid: boolean; error?: string; resolvedIp?: string }> {
  try {
    const parsed = new URL(rawUrl);

    // 1. Protocol validation
    if (isProduction && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Webhooks in production must use secure HTTPS protocol.' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: `Invalid webhook protocol '${parsed.protocol}'. Must be http: or https:.` };
    }

    // 2. Prohibit user-info / embedded credentials
    if (parsed.username || parsed.password) {
      return { valid: false, error: 'Webhook URLs must not contain embedded basic auth credentials.' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 3. Block known metadata domain names directly
    const blockedHostnames = [
      'localhost',
      'metadata.google.internal',
      'instance-data',
      '169.254.169.254',
      'metadata',
    ];

    if (isProduction && blockedHostnames.includes(hostname)) {
      return { valid: false, error: `Direct access to reserved hostname '${hostname}' is prohibited.` };
    }

    // 4. DNS Resolution & IP Range Check
    if (hostname !== 'localhost' || isProduction) {
      try {
        const lookupResult = await dns.lookup(hostname);
        const resolvedIp = lookupResult.address;

        if (isPrivateOrReservedIp(resolvedIp)) {
          return {
            valid: false,
            error: `Target host '${hostname}' resolved to blocked private/metadata IP space (${resolvedIp}).`,
            resolvedIp,
          };
        }

        return { valid: true, resolvedIp };
      } catch (dnsErr: any) {
        return { valid: false, error: `Could not resolve hostname '${hostname}': ${dnsErr.message}` };
      }
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Invalid URL format: ${err.message}` };
  }
}
