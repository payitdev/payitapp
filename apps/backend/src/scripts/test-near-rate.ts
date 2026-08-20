async function getLiveNearNgnRate(): Promise<{ nearUsd: number; usdNgn: number; nearNgn: number }> {
  let nearUsd = 3.20; // fallback
  const usdNgn = 1550; // Proxim USD/NGN rate

  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=NEARUSDT');
    const data: any = await res.json();
    if (data.price) {
      nearUsd = parseFloat(data.price);
    }
  } catch {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=usd');
      const data: any = await res.json();
      if (data.near?.usd) {
        nearUsd = parseFloat(data.near.usd);
      }
    } catch {
      // fallback
    }
  }

  const nearNgn = Math.round(nearUsd * usdNgn);
  return { nearUsd, usdNgn, nearNgn };
}

getLiveNearNgnRate().then(r => console.log('Live NEAR/NGN Market Rates:', r));
