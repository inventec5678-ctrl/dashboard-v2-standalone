// chart_market.js — 通用市場圖表渲染

// Keep track of in-flight request abort controllers
var _chartAbortController = null;
var _quoteAbortController = null;

// ====== In-Memory Cache ======
const _chartCache = new Map(); // key: `${market}|${symbol}|${interval}`, value: { bars: [...], ts: number }

function _getCacheKey(market, symbol, interval) {
    return `${market}|${symbol}|${interval}`;
}

function _setCache(market, symbol, interval, bars) {
    _chartCache.set(_getCacheKey(market, symbol, interval), { bars, ts: Date.now() });
}

function _getCache(market, symbol, interval) {
    return _chartCache.get(_getCacheKey(market, symbol, interval));
}

function _isCacheValid(market, symbol, interval, maxAgeMs = 60000) {
    const entry = _getCache(market, symbol, interval);
    if (!entry) return false;
    return (Date.now() - entry.ts) < maxAgeMs;
}

function _invalidateCache(market, symbol, interval) {
    if (interval === '*' || interval === null) {
        // Clear all intervals for this market+symbol
        var prefix = market + '|' + symbol + '|';
        for (var key of _chartCache.keys()) {
            if (key.startsWith(prefix)) _chartCache.delete(key);
        }
    } else {
        _chartCache.delete(_getCacheKey(market, symbol, interval));
    }
}

// Expose _invalidateCache globally so dashboard.js countdown can force a fresh fetch
window._invalidateCache = _invalidateCache;

// ====== Current Price Line ======
function _updateCurrentPriceLine(market, price) {
    var candleSeries = window[market + 'CandleSeries'];
    if (!candleSeries || !price) return;
    if (window._currentPriceLine) {
        window._currentPriceLine.remove();
        window._currentPriceLine = null;
    }
    window._currentPriceLine = candleSeries.createPriceLine({
        price: price,
        color: '#58A6FF',
        lineWidth: 1,
        lineStyle: 0,
        axisLabelVisible: true,
        title: ' NOW',
    });
}
window._updateCurrentPriceLine = _updateCurrentPriceLine;

// 通用標的載入
export async function loadSymbols(market) {
    // 使用 querySelector 找 select（更寬鬆的匹配）
    var select = document.querySelector('[id="symbol-select-' + market + '"]');
    if (!select) {
        // 嘗試各种可能的大小寫組合
        var attempts = [
            'symbol-select-' + market.toLowerCase(),
            'symbol-select-' + market.toUpperCase(),
            'symbol-select-' + market
        ];
        for (var i = 0; i < attempts.length; i++) {
            select = document.getElementById(attempts[i]);
            if (select) break;
        }
    }
    if (!select) {
        console.warn('[chart_market] loadSymbols: select not found for', market, '- all IDs:', Array.from(document.querySelectorAll('[id^="symbol-select"]')).map(function(e) { return e.id; }));
        return;
    }

    var url;
    if (market === 'CRYPTO') {
        url = window.API_BASE + '/symbols/crypto';
    } else if (market === 'TWSE') {
        url = window.API_BASE + '/symbols/twse';
    } else {
        url = window.API_BASE + '/symbols/' + market.toLowerCase();
    }

    try {
        var resp = await fetch(url);
        var data = await resp.json();
        // Handle both flat {symbols: [...]} and nested {data: {symbols: [...]}} formats
        var symData = data;
        if (!symData.symbols && data.data && data.data.symbols) {
            symData = data.data;
        }
        if (!symData.symbols) { console.warn('no symbols in data'); return; }
        select.innerHTML = '';
        symData.symbols.forEach(function(s) {
            var opt = document.createElement('option');
            if (market === 'TWSE') {
                opt.value = s.code;
                opt.textContent = s.code + (s.name ? ' ' + s.name : '');
            } else {
                opt.value = s.symbol;
                opt.textContent = (s.display || s.symbol) + (s.name ? ' ' + s.name : '');
            }
            select.appendChild(opt);
        });
        // Auto-select first symbol and load chart (fix: initial chart won't show otherwise)
        // Only auto-load for the initially active market (CRYPTO) to avoid triggering US/TWSE on page load
        if (select.options.length > 0) {
            var firstSymbol = select.options[0].value;
            // Only auto-select + load chart/quote if this is the current active market
            // to prevent US/TWSE from loading before their tab is shown
            var currentActive = window.currentMarket || 'CRYPTO';
            if (market === currentActive) {
                window['current' + market + 'Stock'] = firstSymbol;
                loadQuote(market, firstSymbol);
                loadChart(market, firstSymbol, window['current' + market + 'TF'] || 'D');
                console.log('[loadSymbols] auto-selected', market, '→', firstSymbol);
            } else {
                window['current' + market + 'Stock'] = firstSymbol;
                console.log('[loadSymbols] pre-loaded', market, 'symbols, first=', firstSymbol, '(will not load chart until tab activated)');
            }
        }
        console.log('[chart_market] loadSymbols done for', market, ':', select.options.length, 'options');
    } catch (e) {
        console.error('[chart_market] loadSymbols error', market, e);
    }
}

export function loadQuote(market, symbol) {
    if (!symbol || symbol === '') {
        console.warn('[chart_market] loadQuote: empty symbol');
        return;
    }
    // Cancel any in-flight request
    if (_quoteAbortController) {
        _quoteAbortController.abort();
    }
    _quoteAbortController = new AbortController();

    var url;
    if (market === 'CRYPTO') {
        url = window.API_BASE + '/crypto/quote?symbol=' + symbol;
    } else if (market === 'TWSE') {
        url = window.API_BASE + '/twse/quote?stock=' + symbol;
    } else {
        url = window.API_BASE + '/us/quote/' + symbol;
    }
    fetch(url, { signal: _quoteAbortController.signal })
        .then(function(r) {
            console.log('[loadQuote] fetching', url, '→ status', r.status);
            return r.ok ? r.json() : Promise.reject(r.status);
        })
        .then(function(data) {
            if (data.error) { console.warn('[loadQuote] error:', data.error); return; }
            console.log('[loadQuote] ✅', market, symbol, '→ price=' + data.price + ', change=' + (data.change_pct >= 0 ? '+' : '') + data.change_pct.toFixed(2) + '%, vol=' + data.volume);
            // Update countdown timer on successful quote load
            window.lastSuccessfulUpdate = new Date();
            if (window.startCountdown) window.startCountdown();
            var mkt = market === 'CRYPTO' ? 'crypto' : market === 'TWSE' ? 'twse' : 'us';
            var priceEl = document.getElementById('price-' + mkt);
            var changeEl = document.getElementById('change-' + mkt);
            var volEl = document.getElementById('volume-' + mkt);
            if (priceEl) {
                priceEl.textContent = window.fmtPrice(data.price);
                priceEl.className = 'chart-price ' + (data.change_pct >= 0 ? 'up' : 'dn');
            }
            if (window._updateCurrentPriceLine) window._updateCurrentPriceLine(market, data.price);
            // 即時更新 K線最後一根（如果還在同一週期內）
            var candleSeries = window[market + 'CandleSeries'];
            if (candleSeries && data.price) {
                var bars = candleSeries.data();
                if (bars && bars.length > 0) {
                    var lastBar = bars[bars.length - 1];
                    var tfMap = { '15m': 15*60, '1h': 60*60, '4h': 4*60*60, 'D': 24*60*60, '1d': 24*60*60, 'W': 7*24*60*60, '1wk': 7*24*60*60, '1mo': 30*24*60*60, 'M': 30*24*60*60 };
                    var tf = window['current' + market + 'TF'] || 'D';
                    var periodSec = tfMap[tf] || tfMap['1d'];
                    var nowSec = Math.floor(Date.now() / 1000);
                    var lastBarTime = lastBar.time;
                    var diff = nowSec - lastBarTime;
                    if (diff >= 0 && diff <= periodSec) {
                        candleSeries.update({
                            time: lastBarTime,
                            open: lastBar.open,
                            high: Math.max(lastBar.high, data.price),
                            low: Math.min(lastBar.low > 0 ? lastBar.low : data.price, data.price),
                            close: data.price
                        });
                        console.log('[loadQuote] K-line updated: close=' + data.price + ' (diff=' + diff + 's)');
                    }
                }
            }
            if (changeEl) {
                changeEl.textContent = (data.change_pct >= 0 ? '+' : '') + data.change_pct.toFixed(2) + '%';
                changeEl.className = data.change_pct >= 0 ? 'up' : 'dn';
            }
            if (volEl) volEl.textContent = 'Vol: ' + window.fmtNum(data.volume);
        })
        .catch(function(e) { if (e.name === 'AbortError') return; console.error('[chart_market] loadQuote error', market, e); });
}

export function loadChart(market, symbol, tf) {
    if (!symbol || symbol === '') {
        console.warn('[chart_market] loadChart: empty symbol');
        return;
    }
    // Cancel any in-flight request
    if (_chartAbortController) {
        _chartAbortController.abort();
    }
    _chartAbortController = new AbortController();

    var intervalMap = {
        'D': '1d', 'W': '1wk', 'M': '1mo',
        '4h': '4h', '1h': '1h', '15m': '15m', '5m': '5m'
    };
    var interval = intervalMap[tf] || '1d';

    var limitMap = {
        '15m': 300, '1h': 300, '4h': 300, 'D': 365, 'W': 260, 'M': 120
    };
    var limit = limitMap[tf] || 300;
    var url;
    if (market === 'CRYPTO') {
        url = window.API_BASE + '/crypto/klines?symbol=' + symbol + '&interval=' + interval + '&limit=' + limit;
    } else if (market === 'TWSE') {
        url = window.API_BASE + '/twse/klines?stock=' + symbol + '&interval=' + interval + '&limit=' + limit;
    } else {
        url = window.API_BASE + '/' + market.toLowerCase() + '/klines/' + symbol + '?interval=' + interval + '&limit=' + limit;
    }

    // 先查 cache（cache 有效就直接渲染，不 fetch）
    var cached = _getCache(market, symbol, interval);
    if (cached && _isCacheValid(market, symbol, interval)) {
        renderChart(market, cached.bars);
        return;
    }

    fetch(url, { signal: _chartAbortController.signal })
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(raw) {
            // Normalize: TWSE/US={symbol,interval,data:[...]}, some={data:[]}
            var klines = raw.data && Array.isArray(raw.data) ? raw.data : (raw.data && raw.data.data ? raw.data.data : raw.data);
            if (!klines || !klines.length) {
                console.warn('[chart_market] No data for', market, symbol, 'url:', url);
                return;
            }
            _setCache(market, symbol, interval, klines); // 更新 cache
            renderChart(market, klines);
        })
        .catch(function(e) { if (e.name === 'AbortError') return; console.error('[chart_market] Chart load error', market, symbol, url, e); });
}

function renderChart(market, klines) {
    var mkt = market === 'CRYPTO' ? 'crypto' : market === 'TWSE' ? 'twse' : market.toLowerCase();
    var chartId = 'chart-' + mkt;
    var volId = 'chart-' + mkt + '-vol';
    var container = document.getElementById(chartId);
    var volContainer = document.getElementById(volId);
    if (!container) { console.warn('[chart_market] Chart container not found:', chartId); return; }

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

    var chartKey = market + 'Chart';
    var candleKey = market + 'CandleSeries';
    var volKey = market + 'VolSeries';
    var volChartKey = market + 'VolChart';

    // Reuse chart instance if it exists; only create if not
    if (!window[chartKey]) {
        window[chartKey] = LightweightCharts.createChart(container, {
            width: container.clientWidth, height: container.clientHeight || 480,
            layout: { background: { color: '#161B22' }, textColor: '#8B949E' },
            grid: { vertLines: { color: '#1C2128' }, horzLines: { color: '#1C2128' } },
            rightPriceScale: { borderColor: '#30363D' },
            timeScale: { borderColor: '#30363D', timeVisible: true },
        });
        // Apply market-specific timezone formatting to chart time axis
        var tzOffsetMap = { 'TWSE': 8, 'US': -5, 'CRYPTO': 0 };
        var tzOffset = tzOffsetMap[market] || 0;
        window[chartKey].timeScale().applyOptions({
            tickMarkFormatter: function(time, tickMarkType, locale) {
                var d = new Date(time * 1000);
                d.setHours(d.getHours() + tzOffset);
                return d.toISOString().replace('T', ' ').substring(0, 16);
            }
        });
        window[candleKey] = window[chartKey].addCandlestickSeries({
            upColor: '#3FB950', downColor: '#F85149',
            borderUpColor: '#3FB950', borderDownColor: '#F85149',
            wickUpColor: '#3FB950', wickDownColor: '#F85149',
        });
        // Sync via timestamps (reliable, works across different bar counts)
        window[chartKey].timeScale().subscribeVisibleTimeRangeChange(function() {
            var newRange = window[chartKey].timeScale().getVisibleLogicalRange();
            var vc = window[volChartKey];
            if (newRange && vc) { vc.timeScale().setVisibleLogicalRange(newRange); }
        });
        // Sync crosshair main → vol
        window[chartKey].subscribeCrosshairMove(function(param) {
            var cs = window[candleKey];
            var vs = window[volKey];
            var vc = window[volChartKey];
            if (!param || !param.time || !vs || !vc || !cs) return;
            var logical = param.seriesData.get(cs);
            if (logical !== undefined) { vc.setCrosshairPosition(logical.close, param.time, vs); }
        });
    }

    var chart = window[chartKey];
    var candleSeries = window[candleKey];

    candleSeries.setData(cdata);

    var volChart = null, volSeries = null;
    if (volContainer) {
        if (!window[volChartKey]) {
            window[volChartKey] = LightweightCharts.createChart(volContainer, {
                width: volContainer.clientWidth, height: volContainer.clientHeight || 150,
                layout: { background: { color: '#161B22' }, textColor: '#8B949E' },
                grid: { vertLines: { color: '#1C2128' }, horzLines: { color: '#1C2128' } },
                rightPriceScale: { borderColor: '#30363D' },
                timeScale: { borderColor: '#30363D', timeVisible: true },
            });
            window[volKey] = window[volChartKey].addHistogramSeries({ color: '#58A6FF', priceFormat: { type: 'volume' }, priceScaleId: '' });
            window[volChartKey].priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
            // Sync vol → main time scale
            window[volChartKey].timeScale().subscribeVisibleTimeRangeChange(function() {
                var newRange = window[volChartKey].timeScale().getVisibleLogicalRange();
                var mc = window[chartKey];
                if (newRange && mc) { mc.timeScale().setVisibleLogicalRange(newRange); }
            });
            // Sync crosshair vol → main
            window[volChartKey].subscribeCrosshairMove(function(param) {
                var cs = window[candleKey];
                var vs = window[volKey];
                var mc = window[chartKey];
                if (!param || !param.time || !vs || !mc || !cs) return;
                var logical = param.seriesData.get(vs);
                if (logical !== undefined) { mc.setCrosshairPosition(logical.value, param.time, cs); }
            });
        }
        volChart = window[volChartKey];
        volSeries = window[volKey];
        volSeries.setData(vdata);
    }

    // Resize listener (always replace — keyed by market, safe to overwrite)
    var key = 'resize_' + market;
    if (window[key]) window.removeEventListener('resize', window[key]);
    window[key] = function() {
        var c = document.getElementById(chartId);
        var vc = document.getElementById(volId);
        if (window[chartKey] && c) window[chartKey].applyOptions({ width: c.clientWidth });
        if (window[volChartKey] && vc) window[volChartKey].applyOptions({ width: vc.clientWidth });
    };
    window.addEventListener('resize', window[key]);
    window[key]();

    chart.timeScale().fitContent();

    var last = cdata[cdata.length - 1];
    if (last) {
        var priceEl = document.getElementById('price-' + mkt);
        if (priceEl) { priceEl.textContent = last.close.toLocaleString(); priceEl.className = 'chart-price'; }
    }

    window._chartCandleData = cdata;
}

export function onSymbolChange(market, symbol) {
    window['current' + market + 'Stock'] = symbol;
    loadQuote(market, symbol);
    loadChart(market, symbol, window['current' + market + 'TF'] || 'D');
}
