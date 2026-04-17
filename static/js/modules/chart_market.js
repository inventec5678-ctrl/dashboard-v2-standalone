// chart_market.js — 通用市場圖表渲染

// 通用標的載入
export async function loadSymbols(market) {
    var resp = await fetch(window.API_BASE + '/symbols/' + market.toLowerCase());
    var data = await resp.json();
    var select = document.getElementById('symbol-select-' + market);
    if (!select) return;
    select.innerHTML = '';
    data.symbols.forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = market === 'TWSE' ? s.code : s.symbol;
        opt.textContent = (market === 'TWSE' ? s.code : s.symbol) + (s.name ? ' ' + s.name : '');
        select.appendChild(opt);
    });
}

export function loadQuote(market, symbol) {
    var url = window.API_BASE + '/' + market.toLowerCase() + '/quote/' + symbol;
    fetch(url)
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(data) {
            if (data.error) return;
            var priceEl = document.getElementById('price-' + market);
            var changeEl = document.getElementById('change-' + market);
            var volEl = document.getElementById('volume-' + market);
            if (priceEl) {
                priceEl.textContent = window.fmtPrice(data.price);
                priceEl.className = 'chart-price ' + (data.change_pct >= 0 ? 'up' : 'dn');
            }
            if (changeEl) {
                changeEl.textContent = (data.change_pct >= 0 ? '+' : '') + data.change_pct.toFixed(2) + '%';
                changeEl.className = data.change_pct >= 0 ? 'up' : 'dn';
            }
            if (volEl) volEl.textContent = 'Vol: ' + window.fmtNum(data.volume);
        })
        .catch(function() {});
}

export function loadChart(market, symbol, tf) {
    var intervalMap = {
        'D': '1d', 'W': '1wk', 'M': '1mo',
        '4h': '4h', '1h': '1h', '15m': '15m', '5m': '5m'
    };
    var interval = intervalMap[tf] || '1d';
    var url = window.API_BASE + '/' + market.toLowerCase() + '/klines/' + symbol + '?interval=' + interval;
    fetch(url)
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(data) {
            if (!data || !data.data || !data.data.length) return;
            renderChart(market, data.data);
        })
        .catch(function(e) { console.error('Chart load error', market, e); });
}

function renderChart(market, klines) {
    var chartId = 'chart-' + market;
    var volId = 'chart-' + market + '-vol';
    var container = document.getElementById(chartId);
    var volContainer = document.getElementById(volId);
    if (!container) return;

    function normTime(t) {
        if (typeof t === 'number') return t > 1e12 ? Math.floor(t / 1000) : t;
        return t;
    }

    var cdata = klines.map(function(d) {
        return {
            time: normTime(d.time),
            open: parseFloat(d.open),
            high: parseFloat(d.high),
            low: parseFloat(d.low),
            close: parseFloat(d.close)
        };
    });

    var vdata = klines.map(function(d) {
        var vol = parseFloat(d.volume) || 0;
        var color = parseFloat(d.close) >= parseFloat(d.open) ? 'rgba(63,185,80,0.7)' : 'rgba(248,81,73,0.7)';
        return { time: normTime(d.time), value: vol, color: color };
    });

    // Destroy old instance
    var oldChartKey = market + 'Chart';
    if (window[oldChartKey]) {
        window[oldChartKey].remove();
        window[oldChartKey] = null;
        window[market + 'CandleSeries'] = null;
        window[market + 'VolChart'] = null;
        window[market + 'VolSeries'] = null;
    }

    var chart = LightweightCharts.createChart(container, {
        width: container.clientWidth, height: 280,
        layout: { background: { color: '#161B22' }, textColor: '#8B949E' },
        grid: { vertLines: { color: '#1C2128' }, horzLines: { color: '#1C2128' } },
        rightPriceScale: { borderColor: '#30363D' },
        timeScale: { borderColor: '#30363D', timeVisible: true },
    });

    var candleSeries = chart.addCandlestickSeries({
        upColor: '#3FB950', downColor: '#F85149',
        borderUpColor: '#3FB950', borderDownColor: '#F85149',
        wickUpColor: '#3FB950', wickDownColor: '#F85149',
    });
    candleSeries.setData(cdata);

    var volChart = null, volSeries = null;
    if (volContainer) {
        volChart = LightweightCharts.createChart(volContainer, {
            width: volContainer.clientWidth, height: 80,
            layout: { background: { color: '#161B22' }, textColor: '#8B949E' },
            grid: { vertLines: { color: '#1C2128' }, horzLines: { color: '#1C2128' } },
            rightPriceScale: { borderColor: '#30363D' },
            timeScale: { borderColor: '#30363D', timeVisible: true },
            crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        });
        volSeries = volChart.addHistogramSeries({ color: '#58A6FF', priceFormat: { type: 'volume' }, priceScaleId: '' });
        volSeries.setData(vdata);
        volChart.priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

        // Sync time scales
        chart.timeScale().subscribeVisibleTimeRangeChange(function(range) {
            if (volChart && range && range.left != null) volChart.timeScale().setVisibleLogicalRange(range);
        });
        volChart.timeScale().subscribeVisibleTimeRangeChange(function(range) {
            if (chart && range && range.left != null) chart.timeScale().setVisibleLogicalRange(range);
        });

        // Resize handler
        var key = 'resize_' + market;
        window[key] = function() {
            if (chart) { var c = document.getElementById(chartId); if (c) chart.applyOptions({ width: c.clientWidth }); }
            if (volChart) { var vc = document.getElementById(volId); if (vc) volChart.applyOptions({ width: vc.clientWidth }); }
        };
        window.addEventListener('resize', window[key]);
    }

    chart.timeScale().fitContent();

    // Update price display from last candle
    var last = cdata[cdata.length - 1];
    if (last) {
        var priceEl = document.getElementById('price-' + market);
        if (priceEl) { priceEl.textContent = last.close.toLocaleString(); priceEl.className = 'chart-price'; }
    }

    window[oldChartKey] = chart;
    window[market + 'CandleSeries'] = candleSeries;
    window[market + 'VolChart'] = volChart;
    window[market + 'VolSeries'] = volSeries;
}

export function onSymbolChange(market, symbol) {
    window['current' + market + 'Stock'] = symbol;
    loadQuote(market, symbol);
    loadChart(market, symbol, window['current' + market + 'TF'] || 'D');
}
