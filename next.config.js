/** @type {import('next').NextConfig} */
module.exports = {
  // Spotify requires the loopback IP (127.0.0.1) for local redirects; let dev serve JS to it
  allowedDevOrigins: ['127.0.0.1'],
}
