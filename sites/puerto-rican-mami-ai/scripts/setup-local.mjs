import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { portFor } from '../../../tools/dev-port.mjs';

const site=path.resolve(import.meta.dirname,'..');
const secretDir=process.env.SHIPWORDS_SECRETS??path.join(os.homedir(),'.config/shipwords');
const file=path.join(secretDir,'puerto-rican-mami-ai.dev.vars');
fs.mkdirSync(secretDir,{recursive:true});
let text=fs.existsSync(file)?fs.readFileSync(file,'utf8'):fs.readFileSync(path.join(site,'.dev.vars.example'),'utf8');
text=text.replace('BETTER_AUTH_SECRET=replace-with-32-random-bytes','BETTER_AUTH_SECRET='+randomBytes(32).toString('hex'))
  .replace('GUEST_COOKIE_SECRET=replace-with-32-random-bytes','GUEST_COOKIE_SECRET='+randomBytes(32).toString('hex'))
  .replace(/^APP_URL=.*$/m,'APP_URL=http://localhost:'+portFor(site));
fs.writeFileSync(file,text);fs.writeFileSync(path.join(site,'.dev.vars'),text);
console.log('Local configuration ready. No existing provider keys were changed.');
console.log('Run pnpm db:generate, pnpm db:migrate:local, then pnpm dev.');
