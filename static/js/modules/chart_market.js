// chart_market.js — 通用市場圖表渲染（含 SMA/RSI 指標副圖，Iteration 3）

// Keep track of in-flight request abort controllers
var _chartAbortController = null;
var _quoteAbortController = null;

// ── Math helpers ─────────────────────────────────────────────────────────

function _normTime(t) {
    if (typeof t === 'number') return t > 1e12 ? Math.floor(t / 1000) : t;
    return t;
}

function _calcSMA(closes, period) {
    var result = [];
    for (var i = period - 1; i < closes.length; i++) {
        var sum = 0;
        for (var j = 0; j < period; j++) sum += closes[i - j];
        result.push(sum / period);
    }
    return result;
}

function _calcRSI(closes, period) {
    if (closes.length < period + 1) return [];
    var gains = [], losses = [];
    for (var i = 1; i < closes.length; i++) {
        var diff = closes[i] - closes[i - 1];
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? -diff : 0);
    }
    var result = [];
    for (var i = period; i < gains.length; i++) {
        var avgGain = 0, avgLoss = 0;
        for (var j = i - period; j < i; j++) { avgGain += gains[j]; avgLoss += losses[j]; }
        avgGain /= period; avgLoss /= period;
        var rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push(100 - (100 / (1 + rs)));
    }
    return result;
}

// ── 通用標的載入（Iteration 3 — 統一 /api/symbols?market= ────────────────

export async function loadSymbols(market) {
    // Try multiple ID variants
    var select = document.getElementById('symbol-select-' + market.toLowerCase());
    if (!select) {
        var alts = ['symbol-select-' + market.toUpperCase(), 'symbol-select-' + market];
        for (var i = 0; i < alts.length; i++) {
            var s = document.getElementById(alts[i]);
            if (s) { select = s; break; }
        }
    }
    if (!select) return;

    var url = window.API_BASE + '/symbols?market=' + market;
    try {
        var resp = await fetch(url);
        var json = await resp.json();
        var symList = json.data && Array.isArray(json.data) ? json.data : [];
        select.innerHTML = '';
        symList.forEach(function(s) {
            var opt = document.createElement('option');
            opt.value = s.symbol;
            opt.textContent = s.display + (s.name ? ' — ' + s.name : '');
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('[chart_market] loadSymbols error', market, e);
    }
}

export function loadQuote(market, symbol) {
    if (!symbol) return;
    if (_quoteAbortController) _quoteAbortController.abort();
    _quoteAbortController = new AbortController();

    var mkt = market === 'CRYPTO' ? 'crypto' : market === 'TWSE' ? 'twse' : 'us';
    var url;
    if (market === 'CRYPTO') {
        url = window.API_BASE + '/crypto/quote?symbol=' + symbol;
    } else if (market === 'TWSE') {
        url = window.API_BASE + '/twse/quote?stock=' + symbol;
    } else {
        url = window.API_BASE + '/us/quote/' + symbol;
    }
    fetch(url, { signal: _quoteAbortController.signal })
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(data) {
            if (data.error) return;
            var priceEl = document.getElementById('price-' + mkt);
            var changeEl = document.getElementById('change-' + mkt);
            var volEl = document.getElementById('volume-' + mkt);
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
        .catch(function(e) { if (e.name === 'AbortError') return; console.error('[chart_market] loadQuote error', e); });
}

export function loadChart(market, symbol, tf) {
    if (!symbol) return;
    if (_chartAbortController) _chartAbortController.abort();
    _chartAbortController = new AbortController();

    var mkt = market === 'CRYPTO' ? 'crypto' : market === 'TWSE' ? 'twse' : market.toLowerCase();
    var chartEl = document.getElementById('chart-' + mkt);
    if (chartEl) chartEl.classList.add('chart-loading');

    var intervalMap = { 'D': '1d', 'W': '1wk', 'M': '1mo', '4h': '4h', '1h': '1h', '15m': '15m', '5m': '5m' };
    var interval = intervalMap[tf] || '1d';
    var limit = 100;

    var url;
    if (market === 'CRYPTO') {
        url = window.API_BASE + '/crypto/klines?symbol=' + symbol + '&interval=' + interval + '&limit=' + limit;
    } else if (market === 'TWSE') {
        url = window.API_BASE + '/twse/klines?stock=' + symbol + '&interval=' + interval + '&limit=' + limit;
    } else {
        // Use unified endpoint for US
        url = window.API_BASE + '/klines?symbol=' + symbol + '&interval=' + interval + '&limit=' + limit + '&market=' + market;
    }

    fetch(url, { signal: _chartAbortController.signal })
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(raw) {
            var klines = raw.data && Array.isArray(raw.data) ? raw.data : [];
            if (!klines || !klines.length) { console.warn('[chart_market] No data for', market, symbol); return; }
            renderChart(market, klines);
        })
        .catch(function(e) { if (e.name === 'AbortError') return; console.error('[chart_market] Chart load error', e); })
        .finally(function() { if (chartEl) chartEl.classList.remove('chart-loading'); });
}

// ── Core chart renderer — K線 + Vol + SMA pane + RSI pane ────────────────

function renderChart(market, klines) {
    var mkt = market === 'CRYPTO' ? 'crypto' : market === 'TWSE' ? 'twse' : market.toLowerCase();
    var chartId    = 'chart-' + mkt;
    var volId      = 'chart-' + mkt + '-vol';
    var smaId      = 'chart-' + mkt + '-sma';
    var rsiId      = 'chart-' + mkt + '-rsi';

    var container  = document.getElementById(chartId);
    var volEl      = document.getElementById(volId);
    var smaEl      = document.getElementById(smaId);
    var rsiEl      = document.getElementById(rsiId);
    if (!container) return;

    // Normalise candle data
    var cdata = klines.map(function(d) {
        return { time: _normTime(d.time), open: parseFloat(d.open), high: parseFloat(d.high),
                 low: parseFloat(d.low), close: parseFloat(d.close) };
    });
    var vdata = klines.map(function(d) {
        var vol = parseFloat(d.volume) || 0;
        var color = parseFloat(d.close) >= parseFloat(d.open) ? 'rgba(63,185,80,0.7)' : 'rgba(248,81,73,0.7)';
        return { time: _normTime(d.time), value: vol, color: color };
    });
    var closes = cdata.map(function(d) { return d.close; });

    // Destroy old instances
    _destroyMarketCharts(market);

    var chartOpts = {
        width: container.clientWidth, height: container.clientHeight || 360,
        layout: { background: { color: '#161B22' }, textColor: '#8B949E' },
        grid: { vertLines: { color: '#1C2128' }, horzLines: { color: '#1C2128' } },
        rightPriceScale: { borderColor: '#30363D' },
        timeScale: { borderColor: '#30363D', timeVisible: true },
    };

    // Main K-line chart
    var chart = LightweightCharts.createChart(container, chartOpts);
    var candleSeries = chart.addCandlestickSeries({
        upColor: '#3FB950', downColor: '#F85149',
        borderUpColor: '#3FB950', borderDownColor: '#F85149',
        wickUpColor: '#3FB950', wickDownColor: '#F85149',
    });
    candleSeries.setData(cdata);
    chart.timeScale().fitContent();

    // Volume chart
    var volChart = null, volSeries = null;
    if (volEl) {
        volChart = LightweightCharts.createChart(volEl, {
            width: volEl.clientWidth, height: volEl.clientHeight || 120,
            layout: { background: { color: '#161B22' }, textColor: '#8B949E' },
            grid: { vertLines: { color: '#1C2128' }, horzLines: { color: '#1C2128' } },
            rightPriceScale: { borderColor: '#30363D' },
            timeScale: { borderColor: '#30363D', timeVisible: true },
        });
        volSeries = volChart.addHistogramSeries({ color: '#58A6FF', priceFormat: { type: 'volume' }, priceScaleId: '' });
        volSeries.setData(vdata);
        volChart.priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

        _syncTimeScale(chart, volChart);
        _syncCrosshair(chart, volChart, candleSeries, volSeries);
    }

    // SMA pane
    var smaChart = null, smaSeries = null;
    if (smaEl) {
        smaChart = LightweightCharts.createChart(smaEl, {
            width: smaEl.clientWidth, height: smaEl.clientHeight || 100,
            layout: { background: { color: '#161B22' }, textColor: '#8B949E' },
            grid: { vertLines: { color: '#1C2128' }, horzLines: { color: '#1C2128' } },
            rightPriceScale: { borderColor: '#30363D' },
            timeScale: { borderColor: '#30363D', timeVisible: true },
        });
        smaSeries = smaChart.addLineSeries({ color: '#FFA500', lineWidth: 1, title: 'SMA20' });
        var smaVals = _calcSMA(closes, 20);
        var smaTimes = cdata.slice(19).map(function(d) { return d.time; });
        var smaData = smaVals.map(function(v, i) { return { time: smaTimes[i], value: v }; });
        smaSeries.setData(smaData);
        smaChart.timeScale().fitContent();
        _syncTimeScale(chart, smaChart);
    }

    // RSI pane
    var rsiChart = null, rsiSeries = null;
    if (rsiEl) {
        rsiChart = LightweightCharts.createChart(rsiEl, {
            width: rsiEl.clientWidth, height: rsiEl.clientHeight || 100,
            layout: { background: { color: '#161B22' }, textColor: '#8B949E' },
            grid: { vertLines: { color: '#1C2128' }, horzLines: { color: '#1C2128' } },
            rightPriceScale: { borderColor: '#30363D' },
            timeScale: { borderColor: '#30363D', timeVisible: true },
        });
        rsiSeries = rsiChart.addLineSeries({ color: '#9B59B6', lineWidth: 1, title: 'RSI14' });
        var rsiVals = _calcRSI(closes, 14);
        var rsiTimes = cdata.slice(14).map(function(d) { return d.time; });
        var rsiData = rsiVals.map(function(v, i) { return { time: rsiTimes[i], value: v }; });
        rsiSeries.setData(rsiData);

        // RSI reference lines: overbought / oversold
        rsiSeries.createPriceLine({ price: 70, color: '#F85149', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'OB' });
        rsiSeries.createPriceLine({ price: 30, color: '#3FB950', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'OS' });

        rsiChart.timeScale().fitContent();
        _syncTimeScale(chart, rsiChart);
    }

    // Resize handling
    var rk = 'resize_' + market;
    if (window[rk]) window.removeEventListener('resize', window[rk]);
    window[rk] = function() {
        var ids = [chartId, volId, smaId, rsiId];
        var charts = [chart, volChart, smaChart, rsiChart];
        ids.forEach(function(id, i) {
            var el = document.getElementById(id);
            if (el && charts[i]) charts[i].applyOptions({ width: el.clientWidth });
        });
    };
    window.addEventListener('resize', window[rk]);
    window[rk]();

    // Update price display
    var last = cdata[cdata.length - 1];
    if (last) {
        var priceEl = document.getElementById('price-' + mkt);
        if (priceEl) { priceEl.textContent = last.close.toLocaleString(); priceEl.className = 'chart-price'; }
    }

    // Store state
    window._chartCandleData = cdata;
    window[market + 'Chart']       = chart;
    window[market + 'CandleSeries'] = candleSeries;
    window[market + 'VolChart']   = volChart;
    window[market + 'VolSeries']  = volSeries;
    window[market + 'SMAChart']  = smaChart;
    window[market + 'SMASeries']  = smaSeries;
    window[market + 'RSIChart']  = rsiChart;
    window[market + 'RSISeries'] = rsiSeries;
}

function _syncTimeScale(mainChart, slaveChart) {
    mainChart.timeScale().subscribeVisibleTimeRangeChange(function() {
        var r = mainChart.timeScale().getVisibleLogicalRange();
        if (r && slaveChart) slaveChart.timeScale().setVisibleLogicalRange(r);
    });
    slaveChart.timeScale().subscribeVisibleTimeRangeChange(function() {
        var r = slaveChart.timeScale().getVisibleLogicalRange();
        if (r && mainChart) mainChart.timeScale().setVisibleLogicalRange(r);
    });
}

function _syncCrosshair(mainChart, slaveChart, mainSeries, slaveSeries) {
    mainChart.subscribeCrosshairMove(function(p) {
        if (!p || !p.time || !slaveSeries || !slaveChart) return;
        var v = p.seriesData.get(mainSeries);
        if (v !== undefined) slaveChart.setCrosshairPosition(v.close, p.time, slaveSeries);
    });
    slaveChart.subscribeCrosshairMove(function(p) {
        if (!p || !p.time || !mainSeries || !mainChart) return;
        var v = p.seriesData.get(slaveSeries);
        if (v !== undefined) mainChart.setCrosshairPosition(v.value, p.time, mainSeries);
    });
}

function _destroyMarketCharts(market) {
    var keys = [market + 'Chart', market + 'CandleSeries',
                market + 'VolChart', market + 'VolSeries',
                market + 'SMAChart', market + 'SMASeries',
                market + 'RSIChart', market + 'RSISeries'];
    keys.forEach(function(k) {
        if (window[k]) {
            try { window[k].remove(); } catch(e) {}
            window[k] = null;
        }
    });
}

export function onSymbolChange(market, symbol) {
    window['current' + market + 'Stock'] = symbol;
    loadQuote(market, symbol);
    loadChart(market, symbol, window['current' + market + 'TF'] || 'D');
}
