/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  // Workspaces are served from <subdomain>.localhost; let the dev server's
  // own assets and HMR load from those origins.
  allowedDevOrigins: ["*.localhost"],
};

export default nextConfig;
