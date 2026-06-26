import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read API_URL from environment variables
let apiUrl = process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:8000/api';

// If API_URL is just the domain/host (e.g., https://xxx.ngrok-free.app or http://localhost:8000), append /api
if (apiUrl && !apiUrl.endsWith('/api') && !apiUrl.endsWith('/api/')) {
  apiUrl = apiUrl.replace(/\/$/, '') + '/api';
}

console.log(`Configuring Frontend API_URL: ${apiUrl}`);

const content = `window.env = {
  API_URL: "${apiUrl}"
};
`;

// Write to public/env.js
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
fs.writeFileSync(path.join(publicDir, 'env.js'), content);
console.log(`Wrote config to ${path.join(publicDir, 'env.js')}`);

// Write to dist/env.js if dist exists
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, 'env.js'), content);
  console.log(`Wrote config to ${path.join(distDir, 'env.js')}`);
}
