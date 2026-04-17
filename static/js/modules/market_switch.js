// ── Market Switching Module ──

export function switchMarket(market) {
    // 切換前先銷毀舊 chart 實例，防止記憶體 leak
    if (window.chart) {
        window.chart.remove();
        window.chart = null;
        window.candleSeries = null;
    }
    if (window.volChart) {
        window.volChart.remove();
        window.volChart = null;
        window.volSeries = null;
    }
    if (window.twseChart) {
        window.twseChart.remove();
        window.twseChart = null;
        window.twseCandleSeries = null;
    }
    if (window.twseVolChart) {
        window.twseVolChart.remove();
        window.twseVolChart = null;
        window.twseVolSeries = null;
    }
    if (window.usChart) {
        window.usChart.remove();
        window.usChart = null;
        window.usCandleSeries = null;
    }
    if (window.usVolChart) {
        window.usVolChart.remove();
        window.usVolChart = null;
        window.usVolSeries = null;
    }

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
        window.loadTWSEQuote(window.currentTWSEStock);
        window.loadTWSEChart(window.currentTWSEStock, 'D');
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
            b.classList.toggle('active', b.dataset.tf === window.currentTF);
        });
        window.initChart();
        window.loadChartData(window.currentSym, window.currentTF);
        window._highlightCryptoButton('BTCUSDT');
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
        // 載入 US 報價與圖表
        window.loadUSQuote(window.currentUSStock);
        window.loadUSChart(window.currentUSStock, window.currentUSTF);
        // Resize chart in case it was initialized in a hidden container
        setTimeout(function() {
            if (window.usChart) window.usChart.resize();
            if (window.usVolChart) window.usVolChart.resize();
        }, 50);
        // 清除其他市場的策略顯示
        window.renderRankingTable([]);
        var stratConsBody = document.getElementById('strategy-consensus-body');
        if (stratConsBody) stratConsBody.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px">美股模式，暫無策略資料</div>';
        // 重置情緒晶片
        document.getElementById('sc-rsi-val').textContent = '—';
        document.getElementById('sc-regime-val').textContent = '—';
        document.getElementById('sc-momentum-val').textContent = '—';
    }
}
