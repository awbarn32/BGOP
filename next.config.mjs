/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ugmbbcjxvvyadtahetgt.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        // Wikimedia Commons — used for dummy motorcycle photos in dev/testing
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: 'profile.line-scdn.net',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
