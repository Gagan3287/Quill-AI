import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Starting localtunnel on port 8000...");
const lt = spawn('npx', ['localtunnel', '--port', '8000'], { shell: true });

let urlFound = false;

lt.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`[localtunnel] ${output.trim()}`);
  
  // Find URL in output (e.g. "your url is: https://xxxx.loca.lt")
  const match = output.match(/your url is: (https:\/\/[a-zA-Z0-9.-]+)/i);
  if (match && !urlFound) {
    const url = match[1];
    urlFound = true;
    console.log(`\n======================================================`);
    console.log(`Detected Tunnel URL: ${url}`);
    console.log(`======================================================\n`);
    
    // Write URL to tunnel.txt in root
    const tunnelFilePath = path.join(__dirname, 'tunnel.txt');
    fs.writeFileSync(tunnelFilePath, url);
    console.log(`Wrote URL to ${tunnelFilePath}`);
    
    // Publish to free CORS-enabled Key-Value Store (keyvalue.immanuel.co)
    // We base64 encode it to prevent IIS path/dot routing errors
    const base64Url = Buffer.from(url).toString('base64');
    publishToKVStore(base64Url);

    // Push to GitHub repository for redundancy
    pushToGit(url);
  }
});

lt.stderr.on('data', (data) => {
  console.error(`[localtunnel err] ${data.toString().trim()}`);
});

lt.on('close', (code) => {
  console.log(`localtunnel process exited with code ${code}`);
});

function publishToKVStore(base64Val) {
  console.log("Publishing encoded URL to Key-Value Store...");
  // Use native fetch to POST
  fetch(`https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/ndnbt2qd/tunnel_url/${base64Val}`, {
    method: 'POST'
  })
  .then(res => res.text())
  .then(data => {
    if (data.trim() === 'true' || data.trim() === 'True') {
      console.log("Successfully published to Key-Value Store!");
    } else {
      console.warn("Key-Value Store returned unexpected response:", data);
    }
  })
  .catch(err => {
    console.error("Failed to publish to Key-Value Store:", err.message);
  });
}

function pushToGit(url) {
  console.log("Pushing tunnel URL to GitHub...");
  const gitAdd = spawn('git', ['add', 'tunnel.txt'], { shell: true });
  gitAdd.on('close', () => {
    const gitCommit = spawn('git', ['commit', '-m', `chore: update tunnel url to ${url} [skip ci]`], { shell: true });
    gitCommit.on('close', () => {
      const gitPush = spawn('git', ['push', 'origin', 'main'], { shell: true });
      gitPush.on('close', (code) => {
        if (code === 0) {
          console.log("Successfully pushed tunnel URL to GitHub repository!");
        } else {
          console.error("Failed to push tunnel URL to GitHub repository.");
        }
      });
    });
  });
}
