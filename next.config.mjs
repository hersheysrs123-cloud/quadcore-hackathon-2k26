/** @type {import('next').NextConfig} */
const nextConfig = {
  // Basic hardening for every route. A Content-Security-Policy is left for
  // later: KaTeX, the 3D models and the export preview all need testing under one.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Other sites may not frame the app (clickjacking); our own pages still can.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Files are only run as the type the server says they are.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Links out send the origin only, never the full URL with its note ids.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
