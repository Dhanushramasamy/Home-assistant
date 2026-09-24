/**
 * Network and IPv4 utility functions
 */

export function isValidIPv4(ip: string): boolean {
  if (!ip) return false;
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return false;

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255 && (part === "0" || !part.startsWith("0"));
  });
}

export function parseIPv4Octets(ip: string): [string, string, string, string] {
  if (!ip) return ["192", "168", "1", "200"];
  const parts = ip.trim().split(".");
  return [
    parts[0] ?? "192",
    parts[1] ?? "168",
    parts[2] ?? "1",
    parts[3] ?? "200",
  ];
}

export function octetsToIPv4(octets: [string, string, string, string]): string {
  return octets.map((o) => o.trim()).join(".");
}

/**
 * Checks if an IP is within a CIDR subnet (e.g. 192.168.1.0/24)
 */
export function isIpInSubnet(ip: string, subnetCIDR: string): boolean {
  if (!isValidIPv4(ip)) return false;

  try {
    const [subnetIp, maskBitsStr] = subnetCIDR.split("/");
    if (!subnetIp || !maskBitsStr || !isValidIPv4(subnetIp)) return true;

    const maskBits = parseInt(maskBitsStr, 10);
    if (isNaN(maskBits) || maskBits < 0 || maskBits > 32) return true;

    const ipNum = ipToLong(ip);
    const subnetNum = ipToLong(subnetIp);
    const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;

    return (ipNum & mask) === (subnetNum & mask);
  } catch {
    return true; // Fallback gracefully if CIDR parsing fails
  }
}

function ipToLong(ip: string): number {
  return (
    ip
      .split(".")
      .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0) >>> 0
  );
}

/**
 * Returns user-friendly subnet validation state
 */
export function validateIpAgainstSubnet(
  ip: string,
  subnetCIDR: string
): {
  validIp: boolean;
  inSubnet: boolean;
  message: string;
  status: "success" | "warning" | "error";
} {
  if (!ip || ip.trim() === "") {
    return {
      validIp: false,
      inSubnet: false,
      message: "Please enter an IPv4 address.",
      status: "error",
    };
  }

  if (!isValidIPv4(ip)) {
    return {
      validIp: false,
      inSubnet: false,
      message: "Invalid IPv4 address format (e.g. 192.168.1.200).",
      status: "error",
    };
  }

  const inSubnet = isIpInSubnet(ip, subnetCIDR);

  if (inSubnet) {
    return {
      validIp: true,
      inSubnet: true,
      message: "✓ Device is on the configured network",
      status: "success",
    };
  } else {
    return {
      validIp: true,
      inSubnet: false,
      message: `⚠ This device appears to be outside your configured network (${subnetCIDR}).`,
      status: "warning",
    };
  }
}
