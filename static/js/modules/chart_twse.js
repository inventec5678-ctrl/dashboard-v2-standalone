// ── TWSE Chart Module ──

window.twseChart = null;
window.twseCandleSeries = null;
window.twseVolChart = null;
window.twseVolSeries = null;

export function loadTWSEQuote(stockCode) {
    fetch(window.API_BASE + '/twse/quote/' + stockCode)
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(data) {
            if (data.error) return;
            var priceEl = document.getElementById('twse-price');
            var changeEl = document.getElementById('twse-change');
            var volEl = document.getElementById('twse-volume');
            priceEl.textContent = window.fmtPrice(data.price);
            priceEl.className = 'chart-price ' + (data.change_pct >= 0 ? 'up' : 'dn');
            changeEl.textContent = (data.change_pct >= 0 ? '+' : '') + data.change_pct.toFixed(2) + '%';
            changeEl.className = data.change_pct >= 0 ? 'up' : 'dn';
            volEl.textContent = 'Vol: ' + window.fmtNum(data.volume);
        })
        .catch(function() {});
}

export function loadTWSEChart(sym, tf) {
    window.currentMarket = 'TWSE';
    var url = window.API_BASE + '/twse/klines/' + sym + '?interval=' + tf + '&limit=300';
    fetch(url)
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(data) {
            if (!data || !data.length) return;
            data = data.filter(function(d) { return d.time != null && d.time !== undefined; });
            if (!data.length) return;
            function normTime(t) {
                if (t == null) return null;
                if (typeof t === 'number') {
                    if (t > 1e12) return Math.floor(t / 1000);
                    return t;
                }
                return t;
            }
            var cdata = data.map(function(d) {
                return { time: normTime(d.time), open: parseFloat(d.open), high: parseFloat(d.high), low: parseFloat(d.low), close: parseFloat(d.close) };
            });
            var vdata = data.map(function(d) {
                var vol = parseFloat(d.volume) || 0;
                var color = '#58A6FF';
                if (d.close && d.open) {
                    color = parseFloat(d.close) >= parseFloat(d.open) ? 'rgba(63,185,80,0.7)' : 'rgba(248,81,73,0.7)';
                }
                return { time: normTime(d.time), value: vol, color: color };
            });
            if (!window.twseChart) {
                var container = document.getElementById('chart-container-twse');
                var volContainer = document.getElementById('chart-container-twse-vol');
                if (!container) return;
                window.twseChart = LightweightCharts.createChart(container, {
                    width: container.clientWidth, height: 280,
                    layout: { background: { color: '#161B22' }, textColor: '#8B949E' },
                    grid: { vertLines: { color: '#1C2128' }, horzLines: { color: '#1C2128' } },
                    rightPriceScale: { borderColor: '#30363D' },
                    timeScale: { borderColor: '#30363D', timeVisible: true },
                });
                window.twseCandleSeries = window.twseChart.addCandlestickSeries({
                    upColor: '#3FB950', downColor: '#F85149',
                    borderUpColor: '#3FB950', borderDownColor: '#F85149',
                    wickUpColor: '#3FB950', wickDownColor: '#F85149',
                });
                if (volContainer) {
                    window.twseVolChart = LightweightCharts.createChart(volContainer, {
                        width: volContainer.clientWidth, height: 80,
                        layout: { background: { color: '#161B22' }, textColor: '#8B949E' },
                        grid: { vertLines: { color: '#1C2128' }, horzLines: { color: '#1C2128' } },
                        rightPriceScale: { borderColor: '#30363D' },
                        timeScale: { borderColor: '#30363D', timeVisible: true },
                        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
                    });
                    window.twseVolChart.timeScale().subscribeVisibleTimeRangeChange(function(range) {
                        if (window.twseChart && range && range.left != null && range.right != null) window.twseChart.timeScale().setVisibleLogicalRange(range);
                    });
                    window.twseChart.timeScale().subscribeVisibleTimeRangeChange(function(range) {
                        if (window.twseVolChart && range && range.left != null && range.right != null) window.twseVolChart.timeScale().setVisibleLogicalRange(range);
                    });
                    window.twseVolSeries = window.twseVolChart.addHistogramSeries({
                        color: '#58A6FF',
                        priceFormat: { type: 'volume' },
                        priceScaleId: '',
                    });
                    window.twseVolChart.priceScale('').applyOptions({
                        scaleMargins: { top: 0.8, bottom: 0 },
                    });
                }
                window.addEventListener('resize', function() {
                    if (window.twseChart) {
                        var c = document.getElementById('chart-container-twse');
                        if (c) window.twseChart.applyOptions({ width: c.clientWidth });
                    }
                    if (window.twseVolChart) {
                        var vc = document.getElementById('chart-container-twse-vol');
                        if (vc) window.twseVolChart.applyOptions({ width: vc.clientWidth });
                    }
                });
            }
            if (window.twseCandleSeries) window.twseCandleSeries.setData(cdata);
            if (window.twseVolSeries) window.twseVolSeries.setData(vdata);
            if (window.twseChart) window.twseChart.timeScale().fitContent();
            if (window.twseVolChart) window.twseVolChart.timeScale().fitContent();
            var last = cdata[cdata.length - 1];
            if (last) {
                var priceEl = document.getElementById('twse-price-v2');
                if (priceEl) { priceEl.textContent = last.close.toLocaleString(); priceEl.className = 'chart-price'; }
                var chgEl = document.getElementById('twse-change-v2');
                if (chgEl && cdata.length > 1) {
                    var pct = ((last.close - cdata[0].open) / cdata[0].open * 100);
                    chgEl.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
                    chgEl.className = pct >= 0 ? 'up' : 'dn';
                }
            }
        })
        .catch(function(e) {
            console.error('TWSE chart error', e);
        });
}

export function onTWSESearchKeyup(e) {
    var q = e.target.value.trim();
    clearTimeout(window._twseSearchTimer);
    if (q.length < 1) {
        document.getElementById('twse-search-results').style.display = 'none';
        return;
    }
    window._twseSearchTimer = setTimeout(function() {
        fetch(window.API_BASE + '/twse/search?q=' + encodeURIComponent(q))
            .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function(data) {
                var container = document.getElementById('twse-search-results');
                if (!data.results || !data.results.length) {
                    container.innerHTML = '<div style="padding:8px 12px;font-size:11px;color:var(--text-muted)">無結果</div>';
                    container.style.display = 'block';
                    return;
                }
                container.innerHTML = data.results.map(function(s) {
                    return '<div onclick="selectTWSEResult(\'' + s.code + '\', \'' + s.name + '\')" style="padding:7px 12px;cursor:pointer;font-size:11px;display:flex;justify-content:space-between;align-items:center;font-family:var(--font-mono);transition:background 0.1s">' +
                        '<span style="font-weight:700;color:var(--accent-blue)">' + s.code + '</span>' +
                        '<span style="color:var(--text-secondary)">' + s.name + '</span></div>';
                }).join('');
                container.style.display = 'block';
            })
            .catch(function() {});
    }, 300);
}

export function selectTWSEResult(code, name) {
    document.getElementById('twse-search-input').value = code + ' ' + name;
    document.getElementById('twse-search-results').style.display = 'none';
    var sel = document.getElementById('twse-stock-select');
    var exists = false;
    for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === code) { exists = true; break; }
    }
    if (!exists) {
        var opt = document.createElement('option');
        opt.value = code;
        opt.textContent = code + ' ' + name;
        sel.insertBefore(opt, sel.firstChild);
    }
    onTWSEStockChange(code);
}

export function onTWSEStockChange(code) {
    window.currentMarket = 'TWSE';
    window.currentTWSEStock = code;
    var sel1 = document.getElementById('twse-stock-select');
    var sel2 = document.getElementById('twse-stock-select-v2');
    if (sel1) sel1.value = code;
    if (sel2) sel2.value = code;
    var twseTf = 'D';
    document.querySelectorAll('#twse-tf-buttons .tf-btn').forEach(function(b) {
        if (b.classList.contains('active')) twseTf = b.dataset.tf;
    });
    loadTWSEQuote(code);
    loadTWSEChart(code, twseTf);
}

export function onCryptoSymbolChange(val) {
    window.currentSym = val.replace('USDT', '');
    window.loadChartData(window.currentSym, window.currentTF);
    window._highlightCryptoButton(val);
}
