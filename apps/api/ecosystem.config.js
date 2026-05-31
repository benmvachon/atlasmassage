export default {
  apps: [
    {
      name: 'atlas-api',
      script: 'src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/atlasmassage/api-error.log',
      out_file: '/var/log/atlasmassage/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '512M',
      restart_delay: 4000,
      max_restarts: 10,
    },
  ],
};
