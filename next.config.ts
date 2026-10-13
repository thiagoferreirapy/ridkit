import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.15.2",
    "192.168.15.62",
    "192.168.15.5",
    "192.168.15.7",
    "192.168.15.9",
    "192.168.218.25",
    "172.17.18.92",
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
  ],
  async headers() {
    return [{source:"/:path*",headers:[
      {key:"X-Content-Type-Options",value:"nosniff"},
      {key:"X-Frame-Options",value:"DENY"},
      {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
      {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
      {key:"Cross-Origin-Opener-Policy",value:"same-origin"},
      // Browsers ignore HSTS over plain HTTP, so this is harmless on the LAN and active once served over HTTPS.
      {key:"Strict-Transport-Security",value:"max-age=31536000; includeSubDomains"},
      // Report-only until violations are reviewed; switch the key to Content-Security-Policy to enforce.
      {key:"Content-Security-Policy-Report-Only",value:[
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://images.unsplash.com",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join("; ")},
    ]}];
  },
};

export default nextConfig;
