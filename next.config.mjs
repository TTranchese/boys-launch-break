/** @type {import('next').NextConfig} */
const nextConfig = {
  // alasql is a plain JS SQL engine; keep it out of the server bundle.
  serverExternalPackages: ["alasql"],
};

export default nextConfig;
