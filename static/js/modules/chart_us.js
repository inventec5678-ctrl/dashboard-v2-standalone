// ── US Stock Chart Module ──

window.usChart = null;
window.usCandleSeries = null;
window.usVolChart = null;
window.usVolSeries = null;
window._usChartResizeHandler = null;

export function loadUSQuote(symbol) {
    fetch(window.API_BASE + '/us/quote/' + symbol)
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(data) {
            if (data.error) return;
            var priceEl = document.getElementById('us-price-v2');
            var changeEl = document.getElementById('us-change-v2');
            var volEl = document.getElementById('us-volume-v2');
            if (priceEl) {
                priceEl.textContent = window.fmtPrice(data.price);
                priceEl.className = 'chart-price ' + (data.change_pct >= 0 ? 'up' : 'dn');
            }
            if (changeEl) {
                changeEl.textContent = (data.change_pct >= 0 ? '+' : '') + data.change_pct.toFixed(2) + '%';
                changeEl.className = data.change_pct >= 0 ? 'up' : 'dn';
            }
            if (volEl) {
                volEl.textContent = 'Vol: ' + window.fmtNum(data.volume);
            }
        })
        .catch(function() {});
}

export function loadUSChart(symbol, tf) {
    window.currentMarket = 'US';
    var intervalMap = { 'D': '1d', 'W': '1wk', 'M': '1mo' };
    var interval = intervalMap[tf] || '1d';
    var url = window.API_BASE + '/us/klines/' + symbol + '?interval=' + interval + '&limit=300';

    fetch(url)
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(data) {
            if (!data || !data.klines || !data.klines.length) return;
            var klines = data.klines;
            function normTime(t) {
                if (t == null) return null;
                if (typeof t === 'number') {
                    if (t > 1e12) return Math.floor(t / 1000);
                    return t;
                }
                return t;
            }
            var cdata = klines.map(function(d) {
                return {
                    time: normTime(d[0]),
                    open: parseFloat(d[1]),
                    high: parseFloat(d[2]),
                    low: parseFloat(d[3]),
                    close: parseFloat(d[4])
                };
            });
            var vdata = klines.map(function(d) {
                var vol = parseFloat(d[5]) || 0;
                var color = '#58A6FF';
                if (d[4] && d[1]) {
                    color = parseFloat(d[4]) >= parseFloat(d[1]) ? 'rgba(63,185,80,0.7)' : 'rgba(248,81,73,0.7)';
                }
                return { time: normTime(d[0]), value: vol, color: color };
            });

            if (!window.usChart) {
                var container = document.getElementById('chart-container-us');
                var volContainer = document.getElementById('chart-container-us-vol');
                if (!container) return;
                window.usChart = LightweightCharts.createChart(container, {
                    width: container.clientWidth, height: 280,
                    layout: { background: { color: '#161B22' }, textColor: '#8B949E' },
                    grid: { vertLines: { color: '#1C2128' }, horzLines: { color: '#1C2128' } },
                    rightPriceScale: { borderColor: '#30363D' },
                    timeScale: { borderColor: '#30363D', timeVisible: true },
                });
                window.usCandleSeries = window.usChart.addCandlestickSeries({
                    upColor: '#3FB950', downColor: '#F85149',
                    borderUpColor: '#3FB950', borderDownColor: '#F85149',
                    wickUpColor: '#3FB950', wickDownColor: '#F85149',
                });
                if (volContainer) {
                    window.usVolChart = LightweightCharts.createChart(volContainer, {
                        width: volContainer.clientWidth, height: 80,
                        layout: { background: { color: '#161B22' }, textColor: '#8B949E' },
                        grid: { vertLines: { color: '#1C2128' }, horzLines: { color: '#1C2128' } },
                        rightPriceScale: { borderColor: '#30363D' },
                        timeScale: { borderColor: '#30363D', timeVisible: true },
                        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
                    });
                    window.usVolChart.timeScale().subscribeVisibleTimeRangeChange(function(range) {
                        if (window.usChart && range && range.left != null && range.right != null) window.usChart.timeScale().setVisibleLogicalRange(range);
                    });
                    window.usChart.timeScale().subscribeVisibleTimeRangeChange(function(range) {
                        if (window.usVolChart && range && range.left != null && range.right != null) window.usVolChart.timeScale().setVisibleLogicalRange(range);
                    });
                    window.usVolSeries = window.usVolChart.addHistogramSeries({
                        color: '#58A6FF',
                        priceFormat: { type: 'volume' },
                        priceScaleId: '',
                    });
                    window.usVolChart.priceScale('').applyOptions({
                        scaleMargins: { top: 0.8, bottom: 0 },
                    });
                }

                if (window._usChartResizeHandler) {
                    window.removeEventListener('resize', window._usChartResizeHandler);
                }
                window._usChartResizeHandler = function() {
                    if (window.usChart) {
                        var c = document.getElementById('chart-container-us');
                        if (c) window.usChart.applyOptions({ width: c.clientWidth });
                    }
                    if (window.usVolChart) {
                        var vc = document.getElementById('chart-container-us-vol');
                        if (vc) window.usVolChart.applyOptions({ width: vc.clientWidth });
                    }
                };
                window.addEventListener('resize', window._usChartResizeHandler);
            }

            if (window.usCandleSeries) window.usCandleSeries.setData(cdata);
            if (window.usVolSeries) window.usVolSeries.setData(vdata);
            if (window.usChart) window.usChart.timeScale().fitContent();
            if (window.usVolChart) window.usVolChart.timeScale().fitContent();

            var last = cdata[cdata.length - 1];
            if (last) {
                var priceEl = document.getElementById('us-price-v2');
                if (priceEl) {
                    priceEl.textContent = last.close.toLocaleString();
                    priceEl.className = 'chart-price';
                }
                var chgEl = document.getElementById('us-change-v2');
                if (chgEl && cdata.length > 1) {
                    var pct = ((last.close - cdata[0].open) / cdata[0].open * 100);
                    chgEl.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
                    chgEl.className = pct >= 0 ? 'up' : 'dn';
                }
            }
        })
        .catch(function(e) {
            console.error('US chart error', e);
        });
}

export function onUSStockChange(code) {
    window.currentMarket = 'US';
    window.currentUSStock = code;
    var sel = document.getElementById('us-stock-select');
    if (sel) sel.value = code;
    var usTf = window.currentUSTF || 'D';
    document.querySelectorAll('#us-tf-buttons .tf-btn').forEach(function(b) {
        if (b.classList.contains('active')) usTf = b.dataset.tf;
    });
    loadUSQuote(code);
    loadUSChart(code, usTf);
}

export async function populateUSSymbolSelect() {
    try {
        var resp = await fetch(window.API_BASE + '/symbols/us');
        var data = await resp.json();
        var sel = document.getElementById('us-stock-select');
        if (!sel || !data.symbols) return;
        sel.innerHTML = '';
        data.symbols.forEach(function(s) {
            var opt = document.createElement('option');
            opt.value = s.symbol;
            opt.textContent = s.symbol + (s.name ? ' ' + s.name : '');
            sel.appendChild(opt);
        });
        if (data.symbols.length > 0) {
            onUSStockChange(window.currentUSStock || data.symbols[0].symbol);
        }
    } catch (e) {
        console.error('Failed to load US symbols', e);
    }
}
