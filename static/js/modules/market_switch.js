// ── Market Switching Module (Iteration 3) ──

function _destroyAllMarketCharts() {
    ['CRYPTO', 'TWSE', 'US'].forEach(function(m) {
        var keys = [m + 'Chart', m + 'CandleSeries', m + 'VolChart', m + 'VolSeries',
                    m + 'SMAChart', m + 'SMASeries', m + 'RSIChart', m + 'RSISeries'];
        keys.forEach(function(k) {
            if (window[k]) {
                try { window[k].remove(); } catch(e) {}
                window[k] = null;
            }
        });
        var rk = 'resize_' + m;
        if (window[rk]) { window.removeEventListener('resize', window[rk]); window[rk] = null; }
    });
    // Clean up strategy overlay series
    if (window._priceLines) { window._priceLines.forEach(function(l) { try { if (l && l.remove) l.remove(); } catch(e) {} }); window._priceLines = []; }
    if (window._maLineSeries)  { try { window._maLineSeries.remove();  } catch(e) {} window._maLineSeries  = null; }
    if (window._rsiLineSeries) { try { window._rsiLineSeries.remove(); } catch(e) {} window._rsiLineSeries = null; }
}

export function switchMarket(market) {
    window.currentMarket = market;

    // ── 1. Cleanup all chart instances ─────────────────────────────────
    _destroyAllMarketCharts();

    // Clear chart container innerHTML to prevent ghost charts on re-render
    ['crypto', 'twse', 'us'].forEach(function(m) {
        ['chart-' + m, 'chart-' + m + '-vol', 'chart-' + m + '-sma', 'chart-' + m + '-rsi'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
    });

    // ── 2. Clear price displays ───────────────────────────────────────────
    ['crypto', 'twse', 'us'].forEach(function(m) {
        var pe = document.getElementById('price-' + m);
        var ce = document.getElementById('change-' + m);
        var ve = document.getElementById('volume-' + m);
        if (pe) { pe.textContent = '—'; pe.className = 'chart-price'; }
        if (ce) { ce.textContent = '—'; ce.className = 'change-display'; }
        if (ve) ve.textContent = '—';
    });

    // Reset sentiment chips
    ['rsi', 'rsi4h', 'ma20', 'ma50', 'ma200', 'regime', 'momentum', 'cross'].forEach(function(id) {
        var chip = document.getElementById('sc-' + id);
        if (chip) chip.className = 'sentiment-chip neutral';
        var val = document.getElementById('sc-' + id + '-val');
        if (val) val.textContent = '—';
    });

    // ── 3. Tab button active states (200ms CSS transition) ────────────────
    ['crypto', 'twse', 'us', 'strategy'].forEach(function(m) {
        var btn = document.getElementById('tab-btn-' + m);
        if (btn) { btn.classList.remove('active'); }
    });
    var activeBtn = document.getElementById('tab-btn-' + market.toLowerCase());
    if (activeBtn) activeBtn.classList.add('active');

    // ── 4. Show active tab content ─────────────────────────────────────────
    document.querySelectorAll('.tab-content').forEach(function(el) { el.style.display = 'none'; });
    var tabEl = document.getElementById('tab-' + market.toLowerCase());
    if (tabEl) tabEl.style.display = 'block';

    // ── 5. Update page title ─────────────────────────────────────────────
    var titleEl = document.getElementById('topbar-title');
    var titles = { CRYPTO: '📈 加密貨幣量化交易平台', TWSE: '🏦 台股量化交易平台', US: '🇺🇸 美股量化交易平台', STRATEGY: '📊 策略中心' };
    if (titleEl && titles[market]) titleEl.textContent = titles[market];

    // ── 6. Strategy tab ──────────────────────────────────────────────────
    if (market === 'STRATEGY') {
        window.loadStrategies();
        return;
    }

    // ── 7. Load chart data for selected market ────────────────────────────
    var sym = window['current' + market + 'Stock'] || _defaultSymbol(market);
    var tf  = window['current' + market + 'TF'] || 'D';
    window.loadQuote(market, sym);
    window.loadChart(market, sym, tf);

    // ── 8. Clear strategy tables for non-crypto markets ───────────────────
    if (market === 'TWSE' || market === 'US') {
        window.renderRankingTable([]);
        var consBody = document.getElementById('strategy-consensus-body');
        if (consBody) consBody.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px">' + market + ' 模式，暫無策略資料</div>';
    } else if (market === 'CRYPTO') {
        window.loadStrategies();
    }
}

function _defaultSymbol(market) {
    return { CRYPTO: 'BTCUSDT', TWSE: '2330', US: 'AAPL' }[market] || '';
}
