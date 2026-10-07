"use strict";

const QRCode = require('qrcode-terminal/vendor/QRCode');
const QRErrorCorrectLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

function renderQrSvg(value) {
  const qr = new QRCode(-1, QRErrorCorrectLevel.L);
  qr.addData(String(value));
  qr.make();
  const count = qr.getModuleCount();
  const quietZone = 4;
  const size = count + quietZone * 2;
  const path = [];
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (qr.modules[y][x]) path.push(`M${x + quietZone} ${y + quietZone}h1v1h-1z`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR Code WhatsApp"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path.join('')}" fill="#000"/></svg>`;
}

module.exports = { renderQrSvg };
