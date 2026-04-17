// ── Crypto Chart Module ──

// Global chart instances
window.chart = null;
window.candleSeries = null;
window.volChart = null;
window.volSeries = null;
window._chartResizeHandler = null;
window._chartCandleData = [];

var _chartResizeHandler = null;

export function initChart() {
    var container = document.getElementById('chart-container');
    var volContainer = document.getElementById('chart-container-vol');
    if (!container) return;
    if (window.chart) { window.chart.remove(); window.chart = null; }
    window.chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
            background: { color: '#161B22' },
            textColor: '#8B949E',
        },
        grid: {
            vertLines: { color: '#1C2128' },
            horzLines: { color: '#1C2128' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: '#30363D',
        },
        timeScale: {
            borderColor: '#30363D',
            timeVisible: true,
        },
    });
    window.candleSeries = window.chart.addCandlestickSeries({
        upColor: '#3FB950',
        downColor: '#F85149',
        borderUpColor: '#3FB950',
        borderDownColor: '#F85149',
        wickUpColor: '#3FB950',
        wickDownColor: '#F85149',
    });

    // Separate volume chart below
    if (volContainer) {
        if (window.volChart) { window.volChart.remove(); window.volChart = null; }
        var volH = volContainer.clientHeight || 80;
        window.volChart = LightweightCharts.createChart(volContainer, {
            width: volContainer.clientWidth || 600,
            height: volH,
            layout: { background: { color: '#161B22' }, textColor: '#8B949E' },
            grid: { vertLines: { color: '#1C2128' }, horzLines: { color: '#1C2128' } },
            rightPriceScale: { borderColor: '#30363D' },
            timeScale: { borderColor: '#30363D', timeVisible: true },
            crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        });
        window.volChart.timeScale().subscribeVisibleTimeRangeChange(function(range) {
            if (window.chart && range && range.left != null && range.right != null) window.chart.timeScale().setVisibleLogicalRange(range);
        });
        window.chart.timeScale().subscribeVisibleTimeRangeChange(function(range) {
            if (window.volChart && range && range.left != null && range.right != null) window.volChart.timeScale().setVisibleLogicalRange(range);
        });
        window.volSeries = window.volChart.addHistogramSeries({
            color: '#58A6FF',
            priceFormat: { type: 'volume' },
            priceScaleId: '',
        });
        window.volChart.priceScale('').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });
    }

    if (_chartResizeHandler) {
        window.removeEventListener('resize', _chartResizeHandler);
    }
    _chartResizeHandler = function() {
        if (window.chart && container) {
            window.chart.applyOptions({ width: container.clientWidth });
        }
        if (window.volChart && volContainer) {
            window.volChart.applyOptions({ width: volContainer.clientWidth });
        }
    };
    window.addEventListener('resize', _chartResizeHandler);
}

export function loadChartData(sym, tf) {
    sym = sym || window.currentSym;
    tf = tf || window.currentTF;
    var isTWSE = (window.currentMarket === 'TWSE');
    var url = isTWSE
        ? window.API_BASE + '/twse/klines/' + sym + '?interval=' + tf + '&limit=300'
        : window.API_BASE + '/klines?symbol=' + sym.toUpperCase().replace('USDT', '') + '&interval=' + tf + '&limit=300';

    fetch(url)
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(data) {
            if (!data || !data.length) return;
            // Filter out invalid time entries
            data = data.filter(function(d) { return d.time != null && d.time !== undefined; });
            if (!data.length) return;
            function normTime(t) {
                if (t == null) return null;
                if (typeof t === 'number') {
                    if (t > 1e12) return Math.floor(t / 1000);  // ms -> seconds
                    return t;  // already in seconds
                }
                return t;
            }
            var cdata = data.map(function(d) {
                return {
                    time: normTime(d.time),
                    open: parseFloat(d.open),
                    high: parseFloat(d.high),
                    low: parseFloat(d.low),
                    close: parseFloat(d.close)
                };
            });
            var vdata = data.map(function(d) {
                var vol = parseFloat(d.volume) || 0;
                var color = '#58A6FF';
                if (d.close && d.open) {
                    color = parseFloat(d.close) >= parseFloat(d.open) ? 'rgba(63,185,80,0.7)' : 'rgba(248,81,73,0.7)';
                }
                return { time: normTime(d.time), value: vol, color: color };
            });
            window._chartCandleData = cdata;
            if (window.candleSeries) window.candleSeries.setData(cdata);
            if (window.volSeries) window.volSeries.setData(vdata);
            if (window.chart) window.chart.timeScale().fitContent();
            if (window.volChart) window.volChart.timeScale().fitContent();

            if (isTWSE) {
                var sel = document.getElementById('twse-stock-select');
                var stockName = sym;
                if (sel) {
                    for (var i = 0; i < sel.options.length; i++) {
                        if (sel.options[i].value === sym) {
                            stockName = sel.options[i].textContent;
                            break;
                        }
                    }
                }
                var chartSymEl = document.getElementById('chart-sym');
                if (chartSymEl) chartSymEl.textContent = stockName;
            } else {
                var chartSymEl2 = document.getElementById('chart-sym');
                if (chartSymEl2) chartSymEl2.textContent = sym + '/USDT';
            }

            var last = cdata[cdata.length - 1];
            if (last) {
                var priceEl = document.getElementById('chart-price');
                if (priceEl) {
                    priceEl.textContent = window.fmtPrice(last.close);
                    priceEl.className = 'chart-price';
                    if (cdata.length > 1) {
                        var prev = cdata[cdata.length - 2];
                        if (prev) {
                            priceEl.className = 'chart-price ' + (last.close >= prev.close ? 'up' : 'dn');
                        }
                    }
                }
                var chgEl = document.getElementById('chart-change');
                if (chgEl && cdata.length > 1) {
                    var pct = ((last.close - cdata[0].close) / cdata[0].close * 100);
                    chgEl.textContent = window.fmtPct(pct);
                    chgEl.className = pct >= 0 ? 'up' : 'dn';
                }
            }
        })
        .catch(function(e) {
            console.error('chart error', e);
        });
}
