const { get } = require('https');
const { gunzip } = require('zlib');
const { promisify } = require('util');
const { mkdir, writeFile } = require('fs');

const consulHost = process.argv[2];
const outFolder = process.argv[3] || '/certs';
const storageKey = process.argv[4] || 'traefik/acme/account';
(async () => {
  const response = await new Promise((resolve, reject) =>
    get(
      `${consulHost}/v1/kv/${storageKey}/object`,
       {...(process.env.HTTP_AUTH ? { auth: process.env.HTTP_AUTH } : {})},
      res => resolve(res),
    ),
  );
  let body = '';
  response.on('data', d => (body += d));
  const acmeGZ64 = await new Promise((resolve, reject) =>
    response.on('end', () => resolve(JSON.parse(body)[0].Value)),
  );
  // backup to restore with `cat -s backup-base64 | base64 --decode | consul kv put traefik/acme/account/object -`
  // https://github.com/containous/traefik/issues/3847#issuecomment-425535658
  await promisify(writeFile)(`${outFolder}/backup-base64`, acmeGZ64, 'utf8');
  console.log(`backuped traefik/acme/account/object`);
  const acme = JSON.parse((await promisify(gunzip)(Buffer.from(acmeGZ64, 'base64'))).toString());
  acme.DomainsCertificate.Certs.map(c => c.Certificate).map(async c => {
    await promisify(mkdir)(`${outFolder}/${c.Domain}`, { recursive: true });
    const fullchain = Buffer.from(c.Certificate, 'base64').toString('ascii');
    const privkey = Buffer.from(c.PrivateKey, 'base64').toString('ascii');
    await promisify(writeFile)(`${outFolder}/${c.Domain}/privkey.pem`, privkey, 'utf8');
    await promisify(writeFile)(`${outFolder}/${c.Domain}/fullchain.pem`, fullchain, 'utf8');
    await promisify(writeFile)(`${outFolder}/${c.Domain}/cert.pem`, fullchain.split('\n\n')[0], 'utf8');
    await promisify(writeFile)(`${outFolder}/${c.Domain}/chain.pem`, fullchain.split('\n\n')[1], 'utf8');
    console.log(`exported ${c.Domain}`);
  });
})();
