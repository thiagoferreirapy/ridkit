import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.15.62",
    "192.168.15.5",
    "192.168.15.7",
    "192.168.15.9",
    "192.168.218.25",
    "172.17.18.92",
  ],
  async headers() {
    return [{source:"/:path*",headers:[
      {key:"X-Content-Type-Options",value:"nosniff"},
      {key:"X-Frame-Options",value:"DENY"},
      {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
      {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
      {key:"Cross-Origin-Opener-Policy",value:"same-origin"},
    ]}];
  },
};

export default nextConfig;
