const nextConfig = {
  compiler: {
    removeConsole: process.env.ENABLE_FRONTEND_LOGS === 'true' ? false : {
      exclude: [],
    },
  },
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

module.exports = nextConfig;

