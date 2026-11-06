import { readFile } from 'node:fs/promises';

const { EDGE_PRODUCT_ID, EDGE_CLIENT_ID, EDGE_API_KEY, EDGE_PACKAGE_PATH, EDGE_RELEASE_VERSION } = process.env;
for (const [name, value] of Object.entries({ EDGE_PRODUCT_ID, EDGE_CLIENT_ID, EDGE_API_KEY, EDGE_PACKAGE_PATH, EDGE_RELEASE_VERSION })) {
  if (!value) throw new Error(`Missing required configuration: ${name}`);
}
if (!/^[a-z0-9-]+$/i.test(EDGE_PRODUCT_ID)) throw new Error('Invalid Edge product ID');

const base = `https://api.addons.microsoftedge.microsoft.com/v1/products/${EDGE_PRODUCT_ID}/submissions`;
const auth = { Authorization: `ApiKey ${EDGE_API_KEY}`, 'X-ClientID': EDGE_CLIENT_ID };

async function request(url, options = {}, expected = 200) {
  const response = await fetch(url, { ...options, headers: { ...auth, ...options.headers } });
  if (response.status !== expected) {
    const body = (await response.text()).slice(0, 800);
    throw new Error(`Edge API returned HTTP ${response.status}: ${body}`);
  }
  return response;
}

function operationId(response) {
  const location = response.headers.get('location') || '';
  const id = location.split('/').filter(Boolean).at(-1);
  if (!id || !/^[a-z0-9-]+$/i.test(id)) throw new Error('Edge API did not return a valid operation ID');
  return id;
}

async function poll(path) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await request(`${base}/${path}`);
    const result = await response.json();
    if (result.status === 'Succeeded') return result;
    if (result.status === 'Failed') throw new Error(`Edge operation failed: ${JSON.stringify({ code: result.errorCode, message: result.message, errors: result.errors })}`);
    if (result.status !== 'InProgress') throw new Error(`Unexpected Edge status: ${result.status}`);
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
  throw new Error('Edge operation still in progress after 10 minutes; check Partner Center. Do not blindly resubmit.');
}

const buffer = await readFile(EDGE_PACKAGE_PATH);
console.log(`Uploading reviewed Gradezy ${EDGE_RELEASE_VERSION} (${buffer.length} bytes)`);
const upload = await request(`${base}/draft/package`, {
  method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: buffer,
}, 202);
await poll(`draft/package/operations/${operationId(upload)}`);
console.log('Package upload succeeded. Submitting for Microsoft certification.');
const publication = await request(base, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ notes: `Gradezy ${EDGE_RELEASE_VERSION}: reviewed extension update. No automatic grade submission; blank fields only after explicit confirmation.` }),
}, 202);
await poll(`operations/${operationId(publication)}`);
console.log(`Gradezy ${EDGE_RELEASE_VERSION} submitted successfully. Store availability remains subject to Microsoft review.`);
