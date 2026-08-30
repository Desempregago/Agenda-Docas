module.exports = {
  apps: [
    {
      name: "agendamento",
      script: "./dist/server.cjs",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "250M",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
