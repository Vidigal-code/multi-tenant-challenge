/** @type {import('next').NextConfig} */
const nextConfig = {
  // Always suppress console logs on frontend - logging should only happen on backend
  compiler: {
    removeConsole: process.env.ENABLE_FRONTEND_LOGS === 'true' ? false : {
      exclude: [], // Remove all console logs (log, error, warn, info, debug)
    },
  },
  // Suppress Next.js internal logging messages
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

module.exports = nextConfig;

