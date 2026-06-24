// @ts-nocheck
const DEFAULT_FLUTTERWAVE_PUBLIC_KEY = 'FLWPUBK-1c33f3767f57fa6306dfaf7c3792a724-X';

function cleanPublicValue(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || trimmed.startsWith('your_') || trimmed.startsWith('YOUR_')) {
    return null;
  }

  return trimmed;
}

function getFlutterwavePublicKey() {
  return cleanPublicValue(process.env.VITE_FLUTTERWAVE_PUBLIC_KEY)
    || cleanPublicValue(process.env.FLUTTERWAVE_PUBLIC_KEY)
    || cleanPublicValue(process.env.FLW_PUBLIC_KEY)
    || DEFAULT_FLUTTERWAVE_PUBLIC_KEY
    || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  return res.json({
    flutterwavePublicKey: getFlutterwavePublicKey(),
  });
}
