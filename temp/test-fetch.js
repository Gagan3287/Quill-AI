async function run() {
  try {
    const res = await fetch('https://keyvalue.immanuel.co/api/KeyVal/GetValue/ndnbt2qd/tunnel_url');
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('CORS Headers:');
    console.log('Access-Control-Allow-Origin:', res.headers.get('access-control-allow-origin'));
    console.log('Content:', text);
  } catch (err) {
    console.error(err);
  }
}
run();
