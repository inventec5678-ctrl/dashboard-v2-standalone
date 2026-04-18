// ── Market Switching Module ──

export function switchMarket(market) {
    // 切換前先銷毀舊 chart 實例，防止記憶體 leak
    // E fix: removed _highlightCryptoButton('BTCUSDT') from CRYPTO branch

    // TODO-007 fix: clear all market price displays before loading new data
    var markets = ['crypto', 'twse', 'us'];
    markets.forEach(function(m) {
        var pe = document.getElementById('price-' + m);
        var ce = document.getElementById('change-' + m);
        var ve = document.getElementById('volume-' + m);
        if (pe) { pe.textContent = '—'; pe.className = 'chart-price'; }
        if (ce) { ce.textContent = '—'; ce.className = 'change-display'; }
        if (ve) ve.textContent = '—';
    });

    // L fix: cleanup overlay series before destroying charts
    if (window._priceLines) { window._priceLines.forEach(function(line) { try { if (line) line.remove(); } catch(e) {} }); window._priceLines = []; }
    if (window._maLineSeries) { try { window._maLineSeries.remove(); } catch(e) {} window._maLineSeries = null; }
    if (window._rsiLineSeries) { try { window._rsiLineSeries.remove(); } catch(e) {} window._rsiLineSeries = null; }

    // L fix: also cleanup resize listeners for ALL markets
    // When switching market, destroy all charts and their resize listeners
    ['CRYPTO', 'TWSE', 'US'].forEach(function(m) {
        var rk = 'resize_' + m;
        if (window[rk]) {
            window.removeEventListener('resize', window[rk]);
            window[rk] = null;
        }
    });

    // K fix: wrap chart.remove() in try/catch
    try { if (window.CRYPTOChart) { window.CRYPTOChart.remove(); window.CRYPTOChart = null; window.CRYPTOCandleSeries = null; } } catch(e) { console.warn('CRYPTOChart.remove error', e); }
    try { if (window.CRYPTOVolChart) { window.CRYPTOVolChart.remove(); window.CRYPTOVolChart = null; window.CRYPTOVolSeries = null; } } catch(e) { console.warn('CRYPTOVolChart.remove error', e); }
    try { if (window.TWSEChart) { window.TWSEChart.remove(); window.TWSEChart = null; window.TWSECandleSeries = null; } } catch(e) { console.warn('TWSEChart.remove error', e); }
    try { if (window.TWSEVolChart) { window.TWSEVolChart.remove(); window.TWSEVolChart = null; window.TWSEVolSeries = null; } } catch(e) { console.warn('TWSEVolChart.remove error', e); }
    try { if (window.USChart) { window.USChart.remove(); window.USChart = null; window.USCandleSeries = null; } } catch(e) { console.warn('USChart.remove error', e); }
    try { if (window.USVolChart) { window.USVolChart.remove(); window.USVolChart = null; window.USVolSeries = null; } } catch(e) { console.warn('USVolChart.remove error', e); }

    window.currentMarket = market;

    // 更新頁面抬頭標題
    var titleEl = document.getElementById('topbar-title');
    if (titleEl) {
        if (market === 'TWSE') {
            titleEl.textContent = '📈 台股量化交易平台';
        } else if (market === 'US') {
            titleEl.textContent = '🇺🇸 美股量化交易平台';
        } else {
            titleEl.textContent = '📈 加密貨幣量化交易平台';
        }
    }
    document.getElementById('tab-btn-crypto').style.background = market === 'CRYPTO' ? '#333' : 'transparent';
    document.getElementById('tab-btn-crypto').style.color = market === 'CRYPTO' ? '#fff' : 'var(--text-muted)';
    document.getElementById('tab-btn-twse').style.background = market === 'TWSE' ? '#333' : 'transparent';
    document.getElementById('tab-btn-twse').style.color = market === 'TWSE' ? '#fff' : 'var(--text-muted)';
    document.getElementById('tab-btn-strategy').style.background = market === 'STRATEGY' ? '#333' : 'transparent';
    document.getElementById('tab-btn-strategy').style.color = market === 'STRATEGY' ? '#fff' : 'var(--text-muted)';
    document.getElementById('tab-btn-us').style.background = market === 'US' ? '#333' : 'transparent';
    document.getElementById('tab-btn-us').style.color = market === 'US' ? '#fff' : 'var(--text-muted)';

    if (market === 'TWSE') {
        document.getElementById('tab-twse').style.display = 'block';
        document.getElementById('tab-crypto').style.display = 'none';
        document.getElementById('tab-strategy').style.display = 'none';
        window.loadQuote(market, window['current' + market + 'Stock']);
        window.loadChart(market, window['current' + market + 'Stock'], window['current' + market + 'TF'] || 'D');
        // Clear ranking table for TWSE mode
        window.renderRankingTable([]);
        var stratConsBody = document.getElementById('strategy-consensus-body');
        if (stratConsBody) stratConsBody.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px">台股模式，暫無策略資料</div>';
        // Reset sentiment chips
        var sentimentBar = document.getElementById('sentiment-bar');
        if (sentimentBar) {
            sentimentBar.querySelectorAll('.sentiment-chip').forEach(function(chip) {
                chip.className = 'sentiment-chip neutral';
            });
        }
        document.getElementById('sc-rsi-val').textContent = '—';
        document.getElementById('sc-rsi4h-val').textContent = '—';
        document.getElementById('sc-ma20-val').textContent = '—';
        document.getElementById('sc-ma50-val').textContent = '—';
        document.getElementById('sc-ma200-val').textContent = '—';
        document.getElementById('sc-regime-val').textContent = '—';
        document.getElementById('sc-momentum-val').textContent = '—';
        document.getElementById('sc-cross-val').textContent = '—';

    } else if (market === 'CRYPTO') {
        document.getElementById('tab-crypto').style.display = 'block';
        document.getElementById('tab-twse').style.display = 'none';
        document.getElementById('tab-strategy').style.display = 'none';
        document.querySelectorAll('#crypto-tf-buttons .tf-btn').forEach(function(b) {
            b.classList.toggle('active', b.dataset.tf === window.currentCRYPTOTF);
        });
        window.loadQuote(market, window['current' + market + 'Stock']);
        window.loadChart(market, window['current' + market + 'Stock'], window['current' + market + 'TF'] || 'D');
        // Reload crypto strategies when switching back
        window.loadStrategies();

    } else if (market === 'STRATEGY') {
        document.getElementById('tab-strategy').style.display = 'block';
        document.getElementById('tab-crypto').style.display = 'none';
        document.getElementById('tab-twse').style.display = 'none';
        document.getElementById('tab-us').style.display = 'none';
        var titleEl = document.getElementById('topbar-title');
        if (titleEl) titleEl.textContent = '📊 策略中心';
        window.loadStrategies();
    } else if (market === 'US') {
        document.getElementById('tab-us').style.display = 'block';
        document.getElementById('tab-crypto').style.display = 'none';
        document.getElementById('tab-twse').style.display = 'none';
        document.getElementById('tab-strategy').style.display = 'none';
        var titleEl = document.getElementById('topbar-title');
        if (titleEl) titleEl.textContent = '🇺🇸 美股量化交易平台';
        window.loadQuote(market, window['current' + market + 'Stock']);
        window.loadChart(market, window['current' + market + 'Stock'], window['current' + market + 'TF'] || 'D');
        setTimeout(function() {
            if (window.USChart) window.USChart.resize();
            if (window.USVolChart) window.USVolChart.resize();
        }, 50);
        window.renderRankingTable([]);
        var stratConsBody = document.getElementById('strategy-consensus-body');
        if (stratConsBody) stratConsBody.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px">美股模式，暫無策略資料</div>';
        // Reset sentiment chips（與 TWSE 分支相同的邏輯）
        var sentimentBar = document.getElementById('sentiment-bar');
        if (sentimentBar) {
            sentimentBar.querySelectorAll('.sentiment-chip').forEach(function(chip) {
                chip.className = 'sentiment-chip neutral';
            });
        }
        document.getElementById('sc-rsi-val').textContent = '—';
        document.getElementById('sc-rsi4h-val').textContent = '—';
        document.getElementById('sc-ma20-val').textContent = '—';
        document.getElementById('sc-ma50-val').textContent = '—';
        document.getElementById('sc-ma200-val').textContent = '—';
        document.getElementById('sc-regime-val').textContent = '—';
        document.getElementById('sc-momentum-val').textContent = '—';
        document.getElementById('sc-cross-val').textContent = '—';
    }
}
