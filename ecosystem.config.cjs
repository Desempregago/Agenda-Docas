module.exports = {
  apps: [
    {
      name: "agendamento-docas",
      script: "./dist/server.cjs",
      instances: 1,
      autorestart: true,
      watch: false,
      // VPS com 945Mi de RAM: teto alto o bastante p/ não reiniciar à toa,
      // baixo o bastante p/ reiniciar antes do box entrar em swap pesado.
      max_memory_restart: "400M",
      kill_timeout: 10000,
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
