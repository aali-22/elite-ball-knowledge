import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

const key = (secret) => {
  if (!/^[a-f0-9]{64}$/i.test(secret ?? '')) throw new Error('Owner sync is not configured');
  return createHash('sha256').update('owner-data-v1:' + secret).digest();
};
export const signature = (body, timestamp, secret) => createHmac('sha256', key(secret)).update(timestamp + '.' + body).digest('hex');
export function authentic(body, timestamp, supplied, secret, now = Date.now()) {
  if (!/^\d{13}$/.test(timestamp ?? '') || Math.abs(now - Number(timestamp)) > 300_000 || !/^[a-f0-9]{64}$/.test(supplied ?? '')) return false;
  return timingSafeEqual(Buffer.from(signature(body, timestamp, secret), 'hex'), Buffer.from(supplied, 'hex'));
}
export function seal(value, context, secret) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(value)))), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') };
}
export function unseal(value, context, secret) {
  const cipher = createDecipheriv('aes-256-gcm', key(secret), Buffer.from(value.iv, 'base64'));
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  const plain = Buffer.concat([cipher.update(Buffer.from(value.data, 'base64')), cipher.final()]);
  return JSON.parse(gunzipSync(plain, { maxOutputLength: 4_000_000 }).toString('utf8'));
}
