/** @type {import('next').NextConfig} */
const nextConfig = {
  // alasql is a plain JS SQL engine; keep it out of the server bundle.
  serverExternalPackages: ["alasql"],
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
    // Keep type checking in process: restricted runners can block the CLI's
    // piped subprocess and leave `tsc --showConfig` output empty.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
