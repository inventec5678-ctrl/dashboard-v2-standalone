// ── Market Sentiment Module ──

export function setChip(id, val, type) {
    var el = document.getElementById(id);
    if (!el) return;
    el.className = 'sentiment-chip ' + type;
    var v = document.getElementById(id + '-val');
    if (v) v.textContent = val;
}

export function renderMarketSentiment(ind) {
    if (!ind) return;
    var price = ind.price;
    setChip('sc-rsi', ind.rsi ? ind.rsi.toFixed(1) : '—', ind.rsi < 30 ? 'bull' : ind.rsi > 70 ? 'bear' : 'neutral');
    setChip('sc-rsi4h', ind.rsi_4h ? ind.rsi_4h.toFixed(1) : '—', ind.rsi_4h < 30 ? 'bull' : ind.rsi_4h > 70 ? 'bear' : 'neutral');
    setChip('sc-ma20', ind.ma20 ? window.fmtPrice(ind.ma20) : '—', price > ind.ma20 ? 'bull' : 'bear');
    setChip('sc-ma50', ind.ma50 ? window.fmtPrice(ind.ma50) : '—', price > ind.ma50 ? 'bull' : 'bear');
    setChip('sc-ma200', ind.ma200 ? window.fmtPrice(ind.ma200) : '—', price > ind.ma200 ? 'bull' : 'bear');
    var regimeEl = document.getElementById('sc-regime');
    var regimeDot = document.getElementById('sc-regime-dot');
    var regimeVal = document.getElementById('sc-regime-val');
    if (ind.regime_bull) { regimeEl.className = 'sentiment-chip bull'; regimeDot.className = 'regime-dot bull'; regimeVal.textContent = '多頭'; }
    else if (ind.regime_bear) { regimeEl.className = 'sentiment-chip bear'; regimeDot.className = 'regime-dot bear'; regimeVal.textContent = '空頭'; }
    else { regimeEl.className = 'sentiment-chip neutral'; regimeDot.className = 'regime-dot'; regimeVal.textContent = '中立'; }
    setChip('sc-momentum', ind.momentum_7d !== undefined ? window.fmtPct(ind.momentum_7d) : '—', ind.momentum_7d > 0 ? 'bull' : ind.momentum_7d < 0 ? 'bear' : 'neutral');
    var crossVal = '無';
    if (ind.golden_cross) crossVal = '黃金交叉';
    else if (ind.death_cross) crossVal = '死亡交叉';
    setChip('sc-cross', crossVal, ind.golden_cross ? 'bull' : ind.death_cross ? 'bear' : 'neutral');
}
