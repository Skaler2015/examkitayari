/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Standalone output is only needed for the Docker image. On Vercel we let the
  // platform handle output, so it is gated behind BUILD_STANDALONE=true.
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  eslint: {
    // Linting runs in CI; do not block production builds on lint.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "cheerio"],
    // Allow PDF/image uploads through server actions (manual "add post").
    serverActions: { bodySizeLimit: "16mb" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
