const localtunnel = require('localtunnel');

(async () => {
  try {
    const tunnel = await localtunnel({ port: 3000, subdomain: 'dkclim-bot-2026' });
    console.log(`Tunnel running at: ${tunnel.url}`);

    tunnel.on('close', () => {
      console.log('Tunnel closed');
      process.exit(1);
    });
  } catch (error) {
    console.error('Tunnel error:', error);
    process.exit(1);
  }
})();
