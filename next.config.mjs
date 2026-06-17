/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.ORS_NEXT_DIST_DIR || '.next-build',
  typescript: {
    tsconfigPath: './tsconfig.next.json'
  }
};

export default nextConfig;
