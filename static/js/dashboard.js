
var API_BASE = '/api';
var currentTF = '4h';
var currentSym = 'BTC';
var currentMarket = 'CRYPTO';  // 'CRYPTO' or 'TWSE'
var currentTWSEStock = '2330';
var _twseSearchTimer = null;
var chart = null;
var candleSeries = null;
var lastSuccessfulUpdate = null;
var _chartResizeHandler = null;

// ── Utilities ──
function fmt(n, decimals) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    decimals = decimals !== undefined ? decimals : 2;
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPrice(n) {
    if (!n) return '—';
    return '$' + fmt(n);
}

function copyPrice(btn, val) {
    if (!val || val === '—' || val === 'null' || val === 'undefined') return;
    navigator.clipboard.writeText(val.toString()).then(function() {
        btn.classList.add('copied');
        var orig = btn.textContent;
        btn.textContent = '已複製';
        setTimeout(function() { btn.classList.remove('copied'); btn.textContent = orig; }, 1500);
    }).catch(function() {});
}

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtPct(n) {
    if (!n && n !== 0) return '—';
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

function fmtNum(n) {
    if (!n) return '—';
    if (Math.abs(n) >= 1e9) return (n/1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(2) + 'K';
    return n.toFixed(2);
}

// ── Update Badge ──
function updateBadge(status, text) {
    var badge = document.getElementById('update-badge');
    var timeEl = document.getElementById('update-time');
    badge.className = 'update-badge ' + (status || '');
    timeEl.textContent = text || '';
}

function formatTime(date) {
    if (!date) return '--';
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}



function setChip(id, val, type) {
    var el = document.getElementById(id);
    if (!el) return;
    el.className = 'sentiment-chip ' + type;
    var v = document.getElementById(id + '-val');
    if (v) v.textContent = val;
}

// ── TWSE / Market Switching ──
function switchMarket(market) {
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

    currentMarket = market;

    // 更新頁面抬頭標題
    var titleEl = document.getElementById('topbar-title');
    if (titleEl) {
        titleEl.textContent = market === 'TWSE' ? '📈 台股量化交易平台' : '📈 加密貨幣量化交易平台';
    }
    document.getElementById('tab-btn-crypto').style.background = market === 'CRYPTO' ? '#333' : 'transparent';
    document.getElementById('tab-btn-crypto').style.color = market === 'CRYPTO' ? '#fff' : 'var(--text-muted)';
    document.getElementById('tab-btn-twse').style.background = market === 'TWSE' ? '#333' : 'transparent';
    document.getElementById('tab-btn-twse').style.color = market === 'TWSE' ? '#fff' : 'var(--text-muted)';
    document.getElementById('tab-btn-strategy').style.background = market === 'STRATEGY' ? '#333' : 'transparent';
    document.getElementById('tab-btn-strategy').style.color = market === 'STRATEGY' ? '#fff' : 'var(--text-muted)';
    if (market === 'TWSE') {
        document.getElementById('tab-twse').style.display = 'block';
        document.getElementById('tab-crypto').style.display = 'none';
        loadTWSEQuote(currentTWSEStock);
        loadTWSEChart(currentTWSEStock, 'D');
        startTwseAnomTimer();
        // Clear ranking table for TWSE mode - no crypto strategies should show
        renderRankingTable([]);
        // Also clear strategy consensus body since TWSE has no strategy system
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
            b.classList.toggle('active', b.dataset.tf === currentTF);
        });
        initChart();
        loadChartData(currentSym, currentTF);
        _highlightCryptoButton('BTCUSDT');
        // Reload crypto strategies when switching back
        loadStrategies();
    } else if (market === 'STRATEGY') {
        document.getElementById('tab-strategy').style.display = 'block';
        document.getElementById('tab-crypto').style.display = 'none';
        document.getElementById('tab-twse').style.display = 'none';
        var titleEl = document.getElementById('topbar-title');
        if (titleEl) titleEl.textContent = '📊 策略中心';
        // Load strategies into strategy tab
        loadStrategies();
        // Load strategies into strategy tab (renderStrategyOverview handles both consensus-bodies)
    }
}

function loadTWSEQuote(stockCode) {
    fetch(API_BASE + '/twse/quote/' + stockCode)
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(data) {
            if (data.error) return;
            var priceEl = document.getElementById('twse-price');
            var changeEl = document.getElementById('twse-change');
            var volEl = document.getElementById('twse-volume');
            priceEl.textContent = fmtPrice(data.price);
            priceEl.className = 'chart-price ' + (data.change_pct >= 0 ? 'up' : 'dn');
            changeEl.textContent = (data.change_pct >= 0 ? '+' : '') + data.change_pct.toFixed(2) + '%';
            changeEl.className = data.change_pct >= 0 ? 'up' : 'dn';
            volEl.textContent = 'Vol: ' + fmtNum(data.volume);
        })
        .catch(function() {});
}

function _highlightCryptoButton(val) {
    var symbols = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT','DOTUSDT','LINKUSDT','MATICUSDT','UNIUSDT','ATOMUSDT','LTCUSDT','ETCUSDT','XLMUSDT','NEARUSDT','APTUSDT','ARBUSDT','OPUSDT'];
    symbols.forEach(function(s) {
        var btn = document.getElementById('btn-' + s);
        if (!btn) return;
        if (s === val) {
            btn.style.background = 'var(--accent-blue)';
            btn.style.borderColor = 'var(--accent-blue)';
            btn.style.color = 'white';
        } else {
            btn.style.background = 'var(--bg-tertiary)';
            btn.style.borderColor = 'var(--border-color)';
            btn.style.color = 'var(--text-primary)';
        }
    });
}

function onCryptoSymbolChange(val) {
    currentSym = val.replace('USDT', '');
    loadChartData(currentSym, currentTF);
    _highlightCryptoButton(val);
}

function onTWSEStockChange(code) {
    currentMarket = 'TWSE';
    currentTWSEStock = code;
    // Sync both TWSE selects
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

function loadTWSEChart(sym, tf) {
    currentMarket = 'TWSE';
    var url = API_BASE + '/twse/klines/' + sym + '?interval=' + tf + '&limit=300';
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
                    // lightweight-charts v4 accepts Unix timestamp in seconds (integer)
                    // BTC 4h klines: multiple bars per day, need time-of-day precision
                    // Return Unix timestamp in SECONDS (not date string, not ms)
                    if (t > 1e12) return Math.floor(t / 1000);  // ms -> seconds
                    return t;  // already in seconds
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
            // Use existing TWSE chart or create new one
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
            // Update price display
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

function onTWSESearchKeyup(e) {
    var q = e.target.value.trim();
    clearTimeout(_twseSearchTimer);
    if (q.length < 1) {
        document.getElementById('twse-search-results').style.display = 'none';
        return;
    }
    _twseSearchTimer = setTimeout(function() {
        fetch(API_BASE + '/twse/search?q=' + encodeURIComponent(q))
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

function selectTWSEResult(code, name) {
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

function renderMarketSentiment(ind) {
    if (!ind) return;
    var price = ind.price;
    setChip('sc-rsi', ind.rsi ? ind.rsi.toFixed(1) : '—', ind.rsi < 30 ? 'bull' : ind.rsi > 70 ? 'bear' : 'neutral');
    setChip('sc-rsi4h', ind.rsi_4h ? ind.rsi_4h.toFixed(1) : '—', ind.rsi_4h < 30 ? 'bull' : ind.rsi_4h > 70 ? 'bear' : 'neutral');
    setChip('sc-ma20', ind.ma20 ? fmtPrice(ind.ma20) : '—', price > ind.ma20 ? 'bull' : 'bear');
    setChip('sc-ma50', ind.ma50 ? fmtPrice(ind.ma50) : '—', price > ind.ma50 ? 'bull' : 'bear');
    setChip('sc-ma200', ind.ma200 ? fmtPrice(ind.ma200) : '—', price > ind.ma200 ? 'bull' : 'bear');
    var regimeEl = document.getElementById('sc-regime');
    var regimeDot = document.getElementById('sc-regime-dot');
    var regimeVal = document.getElementById('sc-regime-val');
    if (ind.regime_bull) { regimeEl.className = 'sentiment-chip bull'; regimeDot.className = 'regime-dot bull'; regimeVal.textContent = '多頭'; }
    else if (ind.regime_bear) { regimeEl.className = 'sentiment-chip bear'; regimeDot.className = 'regime-dot bear'; regimeVal.textContent = '空頭'; }
    else { regimeEl.className = 'sentiment-chip neutral'; regimeDot.className = 'regime-dot'; regimeVal.textContent = '中立'; }
    setChip('sc-momentum', ind.momentum_7d !== undefined ? fmtPct(ind.momentum_7d) : '—', ind.momentum_7d > 0 ? 'bull' : ind.momentum_7d < 0 ? 'bear' : 'neutral');
    var crossVal = '無';
    if (ind.golden_cross) crossVal = '黃金交叉';
    else if (ind.death_cross) crossVal = '死亡交叉';
    setChip('sc-cross', crossVal, ind.golden_cross ? 'bull' : ind.death_cross ? 'bear' : 'neutral');
}

function computeConsensus(strategies) {
    var matched = strategies.filter(function(s){ return s.match_pct > 0; });
    var fullMatched = strategies.filter(function(s){ return s.match_pct === 100; });

    var short = 0, long = 0, neutral = 0, wrSum = 0, wrCount = 0;
    matched.forEach(function(s) {
        if (s.direction === 'SHORT') short++;
        else if (s.direction === 'LONG') long++;
        else neutral++;
        wrSum += (s.win_rate || 0);
        wrCount++;
    });

    var bias = short > long ? 's' : long > short ? 'l' : 'n';
    var biasLabel = short > long ? 'SHORT' : long > short ? 'LONG' : 'NEUTRAL';
    var biasIcon = short > long ? '🔴' : long > short ? '🟢' : '⚖';
    var wr = wrCount > 0 ? Math.round(wrSum / wrCount) : 0;
    var wrColor = wr >= 60 ? 'l' : wr >= 40 ? 'n' : 's';
    var total = short + long + neutral;

    var entries = fullMatched.map(function(s){ return s.entry_price; }).filter(Boolean);
    var tps = fullMatched.map(function(s){ return s.take_profit; }).filter(Boolean);
    var sls = fullMatched.map(function(s){ return s.stop_loss; }).filter(Boolean);

    function zoneText(arr) {
        if (!arr.length) return { zone: '—', range: '' };
        var min = Math.min.apply(null, arr);
        var max = Math.max.apply(null, arr);
        if (arr.length === 1) return { zone: fmtPrice(min), range: '' };
        return { zone: fmtPrice(min) + ' – ' + fmtPrice(max), range: '(' + arr.length + '筆)' };
    }
    var entryInfo = zoneText(entries);
    var tpInfo = zoneText(tps);
    var slInfo = zoneText(sls);

    return {
        bias: bias, biasLabel: biasLabel, biasIcon: biasIcon,
        wr: wr, wrColor: wrColor,
        short: short, long: long, neutral: neutral, total: total,
        entryZone: entryInfo.zone, entryRange: entryInfo.range,
        tpZone: tpInfo.zone, tpRange: tpInfo.range,
        slZone: slInfo.zone, slRange: slInfo.range,
        hasFullMatched: fullMatched.length > 0
    };
}

function renderStrategyOverview(strategies) {
    if (!strategies || !strategies.length) return;
    window._consensusStrategies = strategies;
    var tfs = ['ALL'];
    strategies.forEach(function(s) { var tf = s.timeframe || 'UNKNOWN'; if (!tfs.includes(tf)) tfs.push(tf); });
    var html = '';
    tfs.forEach(function(tf) {
        var filtered = tf === 'ALL' ? strategies : strategies.filter(function(s) { return s.timeframe === tf; });
        var sc = computeConsensus(filtered);
        var tfIcon = tf === '4H' ? '⏱' : tf === '1D' ? '📅' : tf === '1H' ? '⏰' : tf === 'ALL' ? '🌐' : '📊';
        var tfLabel = tf === 'ALL' ? '🌐 總共識' : tf;
        var wrColor = sc.wr >= 60 ? 'l' : sc.wr >= 40 ? 'n' : 's';
        html += '<div class="cons-row">';
        html += '<div class="cons-row-header">';
        html += '<span class="cons-row-icon">' + tfIcon + '</span>';
        html += '<span class="cons-row-label">' + tfLabel + '</span>';
        html += '<span class="cons-row-bias ' + sc.bias + '">' + sc.biasIcon + ' ' + sc.biasLabel + '</span>';
        html += '<div class="cons-pills" style="margin-left:auto">';
        if (sc.short > 0) html += '<span class="cons-pill s">🔴' + sc.short + '</span>';
        if (sc.long > 0) html += '<span class="cons-pill l">🟢' + sc.long + '</span>';
        if (sc.neutral > 0) html += '<span class="cons-pill n">' + sc.neutral + '</span>';
        html += '</div></div>';
        html += '<div class="cons-row-body">';
        html += '<div class="cons-stat"><div class="cons-stat-label">勝率</div><div class="cons-stat-value ' + wrColor + '">' + sc.wr + '%</div><div class="cons-wr-bar"><div class="cons-wr-fill ' + wrColor + '" style="width:' + sc.wr + '%"></div></div></div>';
        html += '<div class="cons-stat"><div class="cons-stat-label">進場</div><div class="cons-stat-value ' + (sc.hasFullMatched ? 'c' : 'n') + '">' + (sc.hasFullMatched ? sc.entryZone : '—') + '</div><div class="cons-stat-sub">' + sc.entryRange + '</div></div>';
        html += '<div class="cons-stat"><div class="cons-stat-label">止盈</div><div class="cons-stat-value" style="color:var(--accent-green)">' + (sc.hasFullMatched ? sc.tpZone : '—') + '</div><div class="cons-stat-sub">' + sc.tpRange + '</div></div>';
        html += '<div class="cons-stat"><div class="cons-stat-label">止損</div><div class="cons-stat-value" style="color:var(--accent-red)">' + (sc.hasFullMatched ? sc.slZone : '—') + '</div><div class="cons-stat-sub">' + sc.slRange + '</div></div>';
        html += '</div></div>';
    });
    var body = document.getElementById('consensus-body');
    if (body) body.innerHTML = html;
    var stratBody = document.getElementById('strategy-consensus-body');
    if (stratBody) stratBody.innerHTML = html;
}

// ── Strategy Ranking Table ──
var _rankStrategies = [];
var _allStrategies = [];
var _rankSortKey = 'win_rate';
var _rankSortAsc = false;
var _activePriceLines = {};

function renderRankingTable(strategies) {
    _rankStrategies = strategies || [];
    doRankSort();
}

function rankSetSort(key) {
    if (_rankSortKey === key) {
        _rankSortAsc = !_rankSortAsc;
    } else {
        _rankSortKey = key;
        _rankSortAsc = key === 'max_drawdown'; // lower is better for drawdown
    }
    // Update button states
    document.querySelectorAll('.rank-sort-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.sort === key);
    });
    doRankSort();
}

function doRankSort() {
    var key = _rankSortKey;
    var asc = _rankSortAsc;
    var sorted = _rankStrategies.slice().sort(function(a, b) {
        var va = a[key], vb = b[key];
        if (typeof va === 'string') {
            return asc ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        return asc ? (va || 0) - (vb || 0) : (vb || 0) - (va || 0);
    });
    var tbody = document.getElementById('rank-tbody');
    if (!tbody) return;
    if (!sorted.length) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--text-muted)">暫無策略</td></tr>';
        return;
    }
    var html = '';
    sorted.forEach(function(s, i) {
        var rank = i + 1;
        var rankClass = rank <= 3 ? 'rank-' + rank : '';
        var dir = s.direction || 'neutral';
        var badgeClass = dir === 'SHORT' ? 'short' : dir === 'LONG' ? 'long' : 'neutral';
        var dirIcon = dir === 'SHORT' ? '🔴' : dir === 'LONG' ? '🟢' : '⚪';
        var matchPct = s.match_pct || 0;
        var wr = s.win_rate || 0;
        var pf = s.profit_factor || 0;
        var dd = s.max_drawdown || 0;
        var sharpe = s.sharpe || 0;
        var matchClass = matchPct >= 80 ? 'high' : matchPct >= 50 ? 'mid' : 'low';
        var wrClass = wr >= 60 ? 'good' : wr >= 40 ? 'warn' : 'bad';
        var ddClass = dd <= 10 ? 'good' : dd <= 20 ? 'warn' : 'bad';
        var pfClass = pf >= 3 ? 'good' : pf >= 2 ? 'warn' : 'bad';
        var rowClass = rankClass + ' ' + (dir === 'LONG' ? 'row-long' : dir === 'SHORT' ? 'row-short' : '');

        html += '<tr class="' + rowClass + '" data-sid="' + s.strategy_id + '" title="點擊查看詳情">';
        html += '<td class="rank-num">' + rank + '</td>';
        html += '<td colspan="2"><div class="rank-name-cell"><div class="rank-name">' + (s.name || '?') + '</div><div class="rank-tf">' + (s.timeframe || '') + '</div></div></td>';
        html += '<td><span class="rank-badge ' + badgeClass + '">' + dirIcon + ' ' + dir + '</span></td>';
        html += '<td><span class="rank-conditions">' + (s.entry_conditions ? s.entry_conditions.slice(0,3).join('·') : '—') + '</span></td>';
        html += '<td><span class="rank-pct ' + matchClass + '">' + matchPct + '%</span></td>';
        html += '<td><span class="rank-metric ' + wrClass + '">' + wr.toFixed(1) + '%</span></td>';
        html += '<td><span class="rank-metric ' + pfClass + '">' + pf.toFixed(2) + '</span></td>';
        html += '<td><span class="rank-metric ' + ddClass + '">' + dd.toFixed(1) + '%</span></td>';
        html += '<td><span class="rank-metric ' + (sharpe >= 2 ? 'good' : sharpe >= 1 ? 'warn' : 'bad') + '">' + sharpe.toFixed(2) + '</span></td>';
        html += '<td><span class="rank-entry">' + (s.entry_conditions ? s.entry_conditions.length + ' 筆' : '—') + '</span></td>';
        html += '<td><span class="rank-entry">' + fmtPrice(s.entry_price) + '</span></td>';
        html += '</tr>';
    });
    tbody.innerHTML = html;
}

// ── Modal sub-renderers ──
function _renderModalMetrics(s) {
    var dir = (s.direction || 'LONG').toUpperCase();
    var badgeClass = dir === 'SHORT' ? 'short' : dir === 'LONG' ? 'long' : 'neutral';
    var dirIcon = dir === 'SHORT' ? '🔴' : dir === 'LONG' ? '🟢' : '⚪';
    var wr = s.win_rate || 0;
    var pf = s.profit_factor || 0;
    var dd = s.max_drawdown || 0;
    var sharpe = s.sharpe || 0;
    var matchPct = s.match_pct || 0;
    var conditions = [];
    if (s.matched_conditions && s.total_conditions) {
        conditions.push(s.matched_conditions + '/' + s.total_conditions + ' 條件滿足');
    }
    if (s.signal) conditions.push('信號: ' + s.signal);
    if (s.confidence) conditions.push('信心: ' + s.confidence);
    return '\
        <div class="modal-section">\
            <div class="modal-section-title">策略概覽</div>\
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">\
                <span class="rank-badge ' + badgeClass + '" style="font-size:13px;padding:4px 12px">' + dirIcon + ' ' + dir + '</span>\
                <span style="font-size:13px;color:var(--text-secondary)">' + (s.timeframe || '') + '</span>\
                <span style="margin-left:auto;font-size:12px;color:var(--text-muted)">信心度 ' + matchPct + '%</span>\
            </div>\
            <div class="modal-metrics">\
                <div class="modal-metric"><div class="modal-metric-label">勝率</div><div class="modal-metric-value ' + (wr>=60?'good':wr>=40?'warn':'bad') + '">' + wr.toFixed(1) + '%</div></div>\
                <div class="modal-metric"><div class="modal-metric-label">盈虧比</div><div class="modal-metric-value ' + (pf>=3?'good':pf>=2?'warn':'bad') + '">' + pf.toFixed(2) + '</div></div>\
                <div class="modal-metric"><div class="modal-metric-label">最大回撤</div><div class="modal-metric-value ' + (dd<=10?'good':dd<=20?'warn':'bad') + '">' + dd.toFixed(1) + '%</div></div>\
                <div class="modal-metric"><div class="modal-metric-label">Sharpe</div><div class="modal-metric-value ' + (sharpe>=2?'good':sharpe>=1?'warn':'bad') + '">' + sharpe.toFixed(2) + '</div></div>\
            </div>\
        </div>\
        ' + (conditions.length ? '\
        <div class="modal-section">\
            <div class="modal-section-title">觸發條件</div>\
            <div class="modal-tags">' + conditions.map(function(c){ return '<span class="modal-tag">' + c + '</span>'; }).join('') + '</div>\
        </div>' : '');
}

function _renderModalPrices(s) {
    return '\
        <div class="modal-section">\
            <div class="modal-section-title">進場 / 止盈 / 止損</div>\
            <div class="modal-prices">\
                <div class="modal-price-card"><div class="modal-price-label">進場價</div><div class="modal-price-value entry">' + fmtPrice(s.entry_price) + '</div><button class="copy-btn" onclick="copyPrice(this, \'' + s.entry_price + '\')">複製</button></div>\
                <div class="modal-price-card"><div class="modal-price-label">止盈</div><div class="modal-price-value tp">' + fmtPrice(s.take_profit) + '</div><button class="copy-btn" onclick="copyPrice(this, \'' + s.take_profit + '\')">複製</button></div>\
                <div class="modal-price-card"><div class="modal-price-label">止損</div><div class="modal-price-value sl">' + fmtPrice(s.stop_loss) + '</div><button class="copy-btn" onclick="copyPrice(this, \'' + s.stop_loss + '\')">複製</button></div>\
            </div>\
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">\
                <div class="modal-price-card"><div class="modal-price-label">TP%</div><div class="modal-price-value tp">' + (s.tp_pct ? s.tp_pct.toFixed(1) + '%' : '—') + '</div></div>\
                <div class="modal-price-card"><div class="modal-price-label">SL%</div><div class="modal-price-value sl">' + (s.sl_pct ? s.sl_pct.toFixed(1) + '%' : '—') + '</div></div>\
            </div>\
        </div>\
        ' + (s.reason ? '\
        <div class="modal-section">\
            <div class="modal-section-title">原因</div>\
            <div class="modal-reason">' + s.reason + '</div>\
        </div>' : '') + '\
        ' + (s.tp_note ? '\
        <div class="modal-section">\
            <div class="modal-section-title">止盈備註</div>\
            <div style="font-size:12px;color:var(--text-secondary);padding:8px;background:var(--bg-tertiary);border-radius:6px">' + s.tp_note + '</div>\
        </div>' : '') + '\
        <div class="modal-section">\
            <div class="modal-section-title">圖表疊加</div>\
            <div class="modal-chart-btns">\
                <button class="modal-chart-btn" onclick="togglePriceLine(\'entry\')">📍 進場線</button>\
                <button class="modal-chart-btn" onclick="togglePriceLine(\'tp\')">🎯 止盈線</button>\
                <button class="modal-chart-btn" onclick="togglePriceLine(\'sl\')">🛡 止損線</button>\
                <button class="modal-chart-btn" onclick="togglePriceLine(\'ma\')">📈 MA</button>\
                <button class="modal-chart-btn" onclick="togglePriceLine(\'rsi\')">📊 RSI</button>\
                <button class="modal-chart-btn" onclick="clearPriceLines()">清除</button>\
            </div>\
        </div>';
}

function _renderModalConditions(s) {
    var p = s.params || s.parameters || {};
    var dir = (s.direction || 'LONG').toUpperCase();
    var entryConditions = [];

    // Layer 1: from params.long / params.short
    var condObj = dir === 'SHORT' ? (p.short || p) : (p.long || p);
    if (condObj && typeof condObj === 'object') {
        for (var ck in condObj) {
            if (condObj[ck] === true) {
                var readable = ck.replace(/_/g, ' ').replace(/\b\w/g, function(l){ return l.toUpperCase(); });
                entryConditions.push(readable);
            }
        }
    }

    // Layer 2: from entry_conditions directly
    if (entryConditions.length === 0) {
        var ec = s.entry_conditions || s.conditions || [];
        if (typeof ec === 'string') ec = [ec];
        if (Array.isArray(ec) && ec.length > 0) {
            entryConditions = ec;
        }
    }

    if (entryConditions.length === 0) return '';

    var ind = window._currentIndicators || {};
    var rsi = ind.rsi || 50;
    var macd_bull = ind.macd_bull || false;
    var price_above_ma20 = ind.price_above_ma20 || false;
    var price_above_ma50 = ind.price_above_ma50 || false;
    var vol_ratio = ind.vol_ratio || 1;
    var momentum = ind.momentum_7d || 0;
    var evalCondition = function(cond) {
        if (!cond) return false;
        var lower = cond.toLowerCase();
        if (lower.includes('rsi') && lower.includes('<')) {
            var match = cond.match(/<?(\d+)/);
            if (match) return rsi < parseFloat(match[1]);
        }
        if (lower.includes('rsi') && lower.includes('>')) {
            var match = cond.match(/>?(\d+)/);
            if (match) return rsi > parseFloat(match[1]);
        }
        if (lower.includes('ma20') && lower.includes('above')) return price_above_ma20;
        if (lower.includes('ma50') && lower.includes('above')) return price_above_ma50;
        if (lower.includes('vol') && (lower.includes('>') || lower.includes('high') || lower.includes('up'))) return vol_ratio > 1.5;
        if (lower.includes('vol') && lower.includes('<')) return vol_ratio < 0.5;
        if (lower.includes('macd') && lower.includes('bull')) return macd_bull;
        if (lower.includes('momentum') && lower.includes('>')) return momentum > 0;
        if (lower.includes('momentum') && lower.includes('<')) return momentum < 0;
        return false;
    };
    var condHtml = '<div class="modal-section">';
    condHtml += '<div class="modal-section-title">進場條件</div>';
    entryConditions.forEach(function(cond) {
        var satisfied = evalCondition(cond);
        var color = satisfied ? '#3FB950' : '#555';
        var bg = satisfied ? 'rgba(63,185,80,0.1)' : 'rgba(50,50,50,0.3)';
        condHtml += '<div class="cond-item" style="background:' + bg + '">';
        condHtml += '<span style="color:' + color + ';font-size:16px">' + (satisfied ? '✅' : '⚪') + '</span>';
        condHtml += '<span style="color:' + (satisfied ? '#3FB950' : '#8B949E') + ';font-size:13px">' + cond + '</span>';
        condHtml += '</div>';
    });
    condHtml += '</div>';
    return condHtml;
}

function _doRenderModal(s) {
    var dir = s.direction || 'LONG';
    var badgeClass = dir === 'SHORT' ? 'short' : dir === 'LONG' ? 'long' : 'neutral';
    var dirIcon = dir === 'SHORT' ? '🔴' : dir === 'LONG' ? '🟢' : '⚪';
    var wr = s.win_rate || 0;
    var pf = s.profit_factor || 0;
    var dd = s.max_drawdown || 0;
    var sharpe = s.sharpe || 0;
    var matchPct = s.match_pct || 0;
    var matched = s.matched || [];
    var conditions = [];
    if (s.matched_conditions && s.total_conditions) {
        conditions.push(s.matched_conditions + '/' + s.total_conditions + ' 條件滿足');
    }
    if (s.signal) conditions.push('信號: ' + s.signal);
    if (s.confidence) conditions.push('信心: ' + s.confidence);

    var body = document.getElementById('modal-body');
    body.innerHTML = '\
        <div class="modal-section">\
            <div class="modal-section-title">策略概覽</div>\
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">\
                <span class="rank-badge ' + badgeClass + '" style="font-size:13px;padding:4px 12px">' + dirIcon + ' ' + dir + '</span>\
                <span style="font-size:13px;color:var(--text-secondary)">' + (s.timeframe || '') + '</span>\
                <span style="margin-left:auto;font-size:12px;color:var(--text-muted)">信心度 ' + matchPct + '%</span>\
            </div>\
            <div class="modal-metrics">\
                <div class="modal-metric"><div class="modal-metric-label">勝率</div><div class="modal-metric-value ' + (wr>=60?'good':wr>=40?'warn':'bad') + '">' + wr.toFixed(1) + '%</div></div>\
                <div class="modal-metric"><div class="modal-metric-label">盈虧比</div><div class="modal-metric-value ' + (pf>=3?'good':pf>=2?'warn':'bad') + '">' + pf.toFixed(2) + '</div></div>\
                <div class="modal-metric"><div class="modal-metric-label">最大回撤</div><div class="modal-metric-value ' + (dd<=10?'good':dd<=20?'warn':'bad') + '">' + dd.toFixed(1) + '%</div></div>\
                <div class="modal-metric"><div class="modal-metric-label">Sharpe</div><div class="modal-metric-value ' + (sharpe>=2?'good':sharpe>=1?'warn':'bad') + '">' + sharpe.toFixed(2) + '</div></div>\
            </div>\
        </div>\
        <div class="modal-section">\
            <div class="modal-section-title">進場 / 止盈 / 止損</div>\
            <div class="modal-prices">\
                <div class="modal-price-card"><div class="modal-price-label">進場價</div><div class="modal-price-value entry">' + fmtPrice(s.entry_price) + '</div><button class="copy-btn" onclick="copyPrice(this, \'' + s.entry_price + '\')">複製</button></div>\
                <div class="modal-price-card"><div class="modal-price-label">止盈</div><div class="modal-price-value tp">' + fmtPrice(s.take_profit) + '</div><button class="copy-btn" onclick="copyPrice(this, \'' + s.take_profit + '\')">複製</button></div>\
                <div class="modal-price-card"><div class="modal-price-label">止損</div><div class="modal-price-value sl">' + fmtPrice(s.stop_loss) + '</div><button class="copy-btn" onclick="copyPrice(this, \'' + s.stop_loss + '\')">複製</button></div>\
            </div>\
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">\
                <div class="modal-price-card"><div class="modal-price-label">TP%</div><div class="modal-price-value tp">' + (s.tp_pct ? s.tp_pct.toFixed(1) + '%' : '—') + '</div></div>\
                <div class="modal-price-card"><div class="modal-price-label">SL%</div><div class="modal-price-value sl">' + (s.sl_pct ? s.sl_pct.toFixed(1) + '%' : '—') + '</div></div>\
            </div>\
        </div>\
        ' + (conditions.length ? '\
        <div class="modal-section">\
            <div class="modal-section-title">觸發條件</div>\
            <div class="modal-tags">' + conditions.map(function(c){ return '<span class="modal-tag">' + c + '</span>'; }).join('') + '</div>\
        </div>' : '') + '\
        ' + (s.reason ? '\
        <div class="modal-section">\
            <div class="modal-section-title">原因</div>\
            <div class="modal-reason">' + s.reason + '</div>\
        </div>' : '') + '\
        ' + (s.tp_note ? '\
        <div class="modal-section">\
            <div class="modal-section-title">止盈備註</div>\
            <div style="font-size:12px;color:var(--text-secondary);padding:8px;background:var(--bg-tertiary);border-radius:6px">' + s.tp_note + '</div>\
        </div>' : '') + '\
        <div class="modal-section">\
            <div class="modal-section-title">圖表疊加</div>\
            <div class="modal-chart-btns">\
                <button class="modal-chart-btn" onclick="togglePriceLine(\'entry\')">📍 進場線</button>\
                <button class="modal-chart-btn" onclick="togglePriceLine(\'tp\')">🎯 止盈線</button>\
                <button class="modal-chart-btn" onclick="togglePriceLine(\'sl\')">🛡 止損線</button>\
                <button class="modal-chart-btn" onclick="togglePriceLine(\'ma\')">📈 MA</button>\
                <button class="modal-chart-btn" onclick="togglePriceLine(\'rsi\')">📊 RSI</button>\
                <button class="modal-chart-btn" onclick="clearPriceLines()">清除</button>\
            </div>\
        </div>\
    ';

    // Append strategy parameters section
    var params = s.parameters || {};
    if (Object.keys(params).length > 0) {
        var paramsHtml = '<div class="modal-section">';
        paramsHtml += '<div class="modal-section-title">策略參數</div>';
        paramsHtml += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">';
        for (var key in params) {
            paramsHtml += '<div style="background:rgba(50,50,50,0.3);padding:6px 8px;border-radius:4px;font-size:12px">';
            paramsHtml += '<span style="color:#8B949E">' + key + ':</span> ';
            paramsHtml += '<span style="color:#fff;font-weight:600">' + params[key] + '</span>';
            paramsHtml += '</div>';
        }
        paramsHtml += '</div></div>';
        body.innerHTML += paramsHtml;
    }

    // Build entry conditions from params.long / params.short
    var entryConditions = [];
    var p = s.params || s.parameters || {};
    var dir = (s.direction || 'LONG').toUpperCase();
    var condObj = dir === 'SHORT' ? (p.short || p) : (p.long || p);
    if (condObj && typeof condObj === 'object') {
        for (var ck in condObj) {
            if (condObj[ck] === true) {
                var readable = ck.replace(/_/g, ' ').replace(/\b\w/g, function(l){ return l.toUpperCase(); });
                entryConditions.push(readable);
            }
        }
    }
    if (entryConditions.length === 0) {
        var fallback = s.entry_conditions || s.conditions || [];
        if (typeof fallback === 'string') fallback = [fallback];
        if (Array.isArray(fallback) && fallback.length > 0) {
            entryConditions = fallback;
        }
    }
    if (entryConditions.length === 0) {
        var ec = s.entry_conditions;
        if (typeof ec === 'string') ec = [ec];
        if (Array.isArray(ec) && ec.length > 0) {
            entryConditions = ec;
        }
    }
    if (entryConditions.length === 0 && s.signal) {
        var sig = s.signal;
        if (typeof sig === 'string' && sig.length > 0) {
            entryConditions = [sig];
        }
    }
    if (entryConditions.length > 0) {
        var ind = window._currentIndicators || {};
        var rsi = ind.rsi || 50;
        var macd_bull = ind.macd_bull || false;
        var price_above_ma20 = ind.price_above_ma20 || false;
        var price_above_ma50 = ind.price_above_ma50 || false;
        var vol_ratio = ind.vol_ratio || 1;
        var momentum = ind.momentum_7d || 0;
        var evalCondition = function(cond) {
            if (!cond) return false;
            var lower = cond.toLowerCase();
            if (lower.includes('rsi') && lower.includes('<')) {
                var match = cond.match(/<?(\d+)/);
                if (match) return rsi < parseFloat(match[1]);
            }
            if (lower.includes('rsi') && lower.includes('>')) {
                var match = cond.match(/>?(\d+)/);
                if (match) return rsi > parseFloat(match[1]);
            }
            if (lower.includes('ma20') && lower.includes('above')) return price_above_ma20;
            if (lower.includes('ma50') && lower.includes('above')) return price_above_ma50;
            if (lower.includes('vol') && (lower.includes('>') || lower.includes('high') || lower.includes('up'))) return vol_ratio > 1.5;
            if (lower.includes('vol') && lower.includes('<')) return vol_ratio < 0.5;
            if (lower.includes('macd') && lower.includes('bull')) return macd_bull;
            if (lower.includes('momentum') && lower.includes('>')) return momentum > 0;
            if (lower.includes('momentum') && lower.includes('<')) return momentum < 0;
            return false;
        };
        var condHtml = '<div class="modal-section">';
        condHtml += '<div class="modal-section-title">進場條件</div>';
        entryConditions.forEach(function(cond) {
            var satisfied = evalCondition(cond);
            var color = satisfied ? '#3FB950' : '#555';
            var bg = satisfied ? 'rgba(63,185,80,0.1)' : 'rgba(50,50,50,0.3)';
            condHtml += '<div class="cond-item" style="background:' + bg + '">';
            condHtml += '<span style="color:' + color + ';font-size:16px">' + (satisfied ? '✅' : '⚪') + '</span>';
            condHtml += '<span style="color:' + (satisfied ? '#3FB950' : '#8B949E') + ';font-size:13px">' + cond + '</span>';
            condHtml += '</div>';
        });
        condHtml += '</div>';
        body.innerHTML += condHtml;
    }

    window._activeModalStrategy = s;
    window._currentStrategy = s;
    clearPriceLines();
    document.getElementById('modal-title').textContent = s.name || '策略詳情';
    document.getElementById('strategy-modal').classList.add('open');
}

function openStrategyModalById(id) {
    var s = null;
    for (var i = 0; i < _allStrategies.length; i++) {
        if (_allStrategies[i].strategy_id === id) {
            s = _allStrategies[i];
            break;
        }
    }
    if (!s) {
        // fallback to _rankStrategies
        for (var i = 0; i < _rankStrategies.length; i++) {
            if (_rankStrategies[i].strategy_id === id) {
                s = _rankStrategies[i];
                break;
            }
        }
    }
    if (!s) { console.error('Strategy not found:', id); return; }
    window._currentStrategy = s;
    var body = document.getElementById('modal-body');
    if (body) body.innerHTML = '<div style="padding:20px">載入中...</div>';
    document.getElementById('modal-title').textContent = s.name || '策略詳情';
    document.getElementById('strategy-modal').classList.add('open');
    _doRenderModal(s);
}

function closeStrategyModal() {
    document.getElementById('strategy-modal').classList.remove('open');
    // Lines persist on chart after modal closes — use "清除" button to remove
}

// ── Anomaly Panels ──
function renderAnomalyPanels(data) {
    // Volume anomalies
    var volList = document.getElementById('vol-anomaly-list');
    var volAnomalies = data.volume_anomalies || [];
    var volCount = data.vol_count || 0;
    var volStatusLight = document.getElementById('vol-status-light');
    var volStatusDot = document.getElementById('vol-status-dot');
    var volStatusText = document.getElementById('vol-status-text');
    var volBadge = document.getElementById('vol-count-badge');

    var volCritical = volAnomalies.filter(function(v){ return v.severity === 'critical'; }).length;
    var volWarning = volAnomalies.filter(function(v){ return v.severity === 'warning'; }).length;
    var volStatus = volCritical > 0 ? 'critical' : volWarning > 0 ? 'warning' : 'normal';
    var volStatusLabel = volCritical > 0 ? '🚨 嚴重' : volWarning > 0 ? '⚠️ 警示' : '✅ 正常';

    volStatusLight.className = 'anomaly-status-light ' + volStatus;
    volStatusDot.className = 'anomaly-status-dot ' + volStatus;
    volStatusText.textContent = volStatusLabel;
    volBadge.textContent = volCount + ' 異常';
    volBadge.className = 'anomaly-count-badge' + (volCount > 0 ? ' has-anom' : '');

    if (volCount === 0) {
        volList.innerHTML = '<div class="anomaly-empty"><div class="anomaly-empty-icon">✅</div>目前無成交量異常 — 全市場正常</div>';
    }
    // Always render all volume results (sorted by ratio)
    var volHtml = '';
    var allVols = data.volume_anomalies || volAnomalies;
    allVols.forEach(function(v) {
        var ratioClass = v.severity === 'critical' ? 'critical' : v.severity === 'warning' ? 'warning' : 'normal';
        volHtml += '<div class="anomaly-row">';
        volHtml += '<span class="anomaly-row-icon">' + (v.emoji || '✅') + '</span>';
        volHtml += '<span class="anomaly-row-sym">' + v.symbol + '</span>';
        volHtml += '<span class="anomaly-row-ratio ' + ratioClass + '">' + v.ratio + 'x</span>';
        volHtml += '<span class="anomaly-row-detail">' + (v.today_volume ? fmtNum(v.today_volume) : (v.avg_volume ? '均' + fmtNum(v.avg_volume) : '')) + '</span>';
        volHtml += '</div>';
    });
    if (volHtml) volList.innerHTML = volHtml;

    // Order book anomalies
    var obList = document.getElementById('ob-anomaly-list');
    var obAnomalies = data.ob_anomalies || [];
    var obCount = data.ob_count || 0;
    var obStatusLight = document.getElementById('ob-status-light');
    var obStatusDot = document.getElementById('ob-status-dot');
    var obStatusText = document.getElementById('ob-status-text');
    var obBadge = document.getElementById('ob-count-badge');

    var obCritical = obAnomalies.filter(function(o){ return o.severity === 'critical'; }).length;
    var obWarning = obAnomalies.filter(function(o){ return o.severity === 'warning'; }).length;
    var obStatus = obCritical > 0 ? 'critical' : obWarning > 0 ? 'warning' : 'normal';
    var obStatusLabel = obCritical > 0 ? '🚨 嚴重' : obWarning > 0 ? '⚠️ 警示' : '✅ 正常';

    obStatusLight.className = 'anomaly-status-light ' + obStatus;
    obStatusDot.className = 'anomaly-status-dot ' + obStatus;
    obStatusText.textContent = obStatusLabel;
    obBadge.textContent = obCount + ' 異常';
    obBadge.className = 'anomaly-count-badge' + (obCount > 0 ? ' has-anom' : '');

    if (obCount === 0) {
        obList.innerHTML = '<div class="anomaly-empty"><div class="anomaly-empty-icon">✅</div>目前無掛單異常 — 全市場正常</div>';
    }
    // Always render all OB results
    var obHtml = '';
    obAnomalies.slice(0, 20).forEach(function(o) {
        var ratioClass = o.severity === 'critical' ? 'critical' : o.severity === 'warning' ? 'warning' : 'normal';
        var bidsTxt = o.current_bids > 0 ? ('均' + fmtNum(o.avg_bids)) : '—';
        obHtml += '<div class="anomaly-row">';
        obHtml += '<span class="anomaly-row-icon">' + (o.emoji || '✅') + '</span>';
        obHtml += '<span class="anomaly-row-sym">' + o.symbol + '</span>';
        obHtml += '<span class="anomaly-row-ratio ' + ratioClass + '">' + o.ratio + 'x</span>';
        obHtml += '<span class="anomaly-row-detail">' + bidsTxt + '</span>';
        obHtml += '</div>';
    });
    if (obHtml) obList.innerHTML = obHtml;
}

function loadAnomalies() {
    fetch(API_BASE + '/dashboard/anomalies')
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(data) {
            renderAnomalyPanels(data);
        })
        .catch(function(e) {
            console.error('anomalies error', e);
            document.getElementById('vol-anomaly-list').innerHTML = '<div class="anomaly-empty">載入失敗</div>';
            document.getElementById('ob-anomaly-list').innerHTML = '<div class="anomaly-empty">載入失敗</div>';
        });
}

// ── TWSE Anomaly Panels ──
function renderTwseAnomalies(data) {
    var list = document.getElementById('twse-anom-list');
    var anomalies = data && data.anomalies ? data.anomalies : [];
    var total = (data && data.total) || 0;
    var critical = (data && data.critical_count) || 0;
    var warning = (data && data.warning_count) || 0;
    var statusLight = document.getElementById('twse-anom-status-light');
    var statusDot = document.getElementById('twse-anom-status-dot');
    var statusText = document.getElementById('twse-anom-status-text');
    var badge = document.getElementById('twse-anom-count-badge');

    if (!list) {
        return;
    }

    var status = critical > 0 ? 'critical' : warning > 0 ? 'warning' : 'normal';
    var statusLabel = critical > 0 ? '🚨 嚴重' : warning > 0 ? '⚠️ 警示' : '✅ 正常';
    if (statusLight) statusLight.className = 'anomaly-status-light ' + status;
    if (statusDot) statusDot.className = 'anomaly-status-dot ' + status;
    if (statusText) statusText.textContent = statusLabel;
    if (badge) {
        badge.textContent = total + ' 異常';
        badge.className = 'anomaly-count-badge' + (total > 0 ? ' has-anom' : '');
    }

    if (total === 0) {
        list.innerHTML = '<div class="anomaly-empty"><div class="anomaly-empty-icon">✅</div>目前無台股異常</div>';
        return;
    }

    var html = '';
    anomalies.forEach(function(a) {
        var ratioClass = a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'normal';
        var typeLabel = a.type === 'volume_spike' ? '量' : a.type === 'price_spike' ? '價' : '缺口';
        html += '<div class="anomaly-row">';
        html += '<span class="anomaly-row-icon">' + (a.emoji || '⚠️') + '</span>';
        html += '<span class="anomaly-row-sym" style="width:60px;display:inline-block;">' + a.stock + '</span>';
        html += '<span style="font-size:11px;color:var(--text-secondary);width:60px;display:inline-block;">' + (a.name || '') + '</span>';
        html += '<span class="anomaly-row-ratio ' + ratioClass + '">' + (a.value > 0 ? '+' : '') + a.value + '%</span>';
        html += '<span class="anomaly-row-detail" style="width:80px;display:inline-block;">' + typeLabel + ' · ' + (a.time || '') + '</span>';
        html += '</div>';
    });
    list.innerHTML = html;
}

function loadTwseAnomalies() {
    var list = document.getElementById('twse-anom-list');
    fetch(API_BASE + '/twse/anomalies/realtime')
        .then(function(r) {
            if (!r.ok) return Promise.reject(r.status);
            return r.json();
        })
        .then(function(data) {
            renderTwseAnomalies(data);
        })
        .catch(function(e) {
            var el = document.getElementById('twse-anom-list');
            if (el) el.innerHTML = '<div class="anomaly-empty">載入失敗: ' + e + '</div>';
        });
}

var _twseAnomTimer = null;
function startTwseAnomTimer() {
    if (_twseAnomTimer) clearInterval(_twseAnomTimer);
    loadTwseAnomalies();
    _twseAnomTimer = setInterval(loadTwseAnomalies, 60000);
}


// ── Load Strategies ──
function loadStrategies() {
    Promise.all([
        fetch(API_BASE + '/strategies/live').then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); }),
        fetch(API_BASE + '/strategies/all').then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
    ])
    .then(function(results) {
        var liveData = results[0];
        var allData = results[1];
        var liveStrategies = liveData.strategies || [];
        var allStrategies = allData.strategies || [];
        // Prefer live metrics over stored metrics
        var liveMetrics = {};
        var allStrategiesMap = {};
        allStrategies.forEach(function(s) { allStrategiesMap[s.strategy_id] = s; });
        liveStrategies.forEach(function(s) { 
            liveMetrics[s.strategy_id] = s; 
            // Merge params from allStrategies if available
            if (allStrategiesMap[s.strategy_id] && allStrategiesMap[s.strategy_id].params) {
                s.params = allStrategiesMap[s.strategy_id].params;
            }
        });
        var combined = [];
        var seen = {};
        // First add all live strategies (with merged params)
        liveStrategies.forEach(function(s) {
            if (!seen[s.strategy_id]) {
                seen[s.strategy_id] = true;
                combined.push(s);
            }
        });
        // Then add experiment strategies that aren't in live
        allStrategies.forEach(function(s) {
            if (!seen[s.strategy_id] && (s.win_rate || 0) > 0) {
                seen[s.strategy_id] = true;
                combined.push(s);
            }
        });
        window._allStrategies = combined;  // store complete list for openStrategyModalById
        renderStrategyOverview(combined);
        renderMarketSentiment(liveData.indicators || {});
        renderRankingTable(combined);
        // Also render to strategy tab tbody
        var stratTbody = document.getElementById('strategy-rank-tbody');
        if (stratTbody) {
            var key = _rankSortKey;
            var asc = _rankSortAsc;
            var sorted = combined.slice().sort(function(a, b) {
                var va = a[key], vb = b[key];
                if (typeof va === 'string') {
                    return asc ? va.localeCompare(vb) : vb.localeCompare(va);
                }
                return asc ? (va || 0) - (vb || 0) : (vb || 0) - (va || 0);
            });
            if (!sorted.length) {
                stratTbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--text-muted)">暫無策略</td></tr>';
            } else {
                var html = '';
                sorted.forEach(function(s, i) {
                    var rank = i + 1;
                    var rankClass = rank <= 3 ? 'rank-' + rank : '';
                    var dir = s.direction || 'neutral';
                    var badgeClass = dir === 'SHORT' ? 'short' : dir === 'LONG' ? 'long' : 'neutral';
                    var dirIcon = dir === 'SHORT' ? '🔴' : dir === 'LONG' ? '🟢' : '⚪';
                    var matchPct = s.match_pct || 0;
                    var wr = s.win_rate || 0;
                    var pf = s.profit_factor || 0;
                    var dd = s.max_drawdown || 0;
                    var sharpe = s.sharpe || 0;
                    var matchClass = matchPct >= 80 ? 'high' : matchPct >= 50 ? 'mid' : 'low';
                    var wrClass = wr >= 60 ? 'good' : wr >= 40 ? 'warn' : 'bad';
                    var ddClass = dd <= 10 ? 'good' : dd <= 20 ? 'warn' : 'bad';
                    var sharpeClass = sharpe >= 1 ? 'good' : sharpe >= 0.5 ? 'warn' : 'bad';
                    html += '<tr class="' + rankClass + '" data-sid="' + escHtml(s.strategy_id) + '" onclick="openStrategyModalById(this.dataset.sid)" style="cursor:pointer" title="查看策略詳情">';
                    html += '<td>' + rank + '</td>';
                    html += '<td><span class="dir-badge ' + badgeClass + '">' + dirIcon + '</span> ' + escHtml(s.name || s.strategy_id) + '</td>';
                    html += '<td>' + (s.timeframe || '-') + '</td>';
                    html += '<td>' + dir + '</td>';
                    html += '<td><span class="metric-badge ' + matchClass + '">' + matchPct.toFixed(1) + '%</span></td>';
                    html += '<td><span class="metric-badge ' + wrClass + '">' + (wr >= 0 ? wr.toFixed(1) + '%' : '—') + '</span></td>';
                    html += '<td>' + (pf > 0 ? pf.toFixed(2) : '—') + '</td>';
                    html += '<td><span class="metric-badge ' + ddClass + '">' + (dd > 0 ? dd.toFixed(1) + '%' : '—') + '</span></td>';
                    html += '<td><span class="metric-badge ' + sharpeClass + '">' + (sharpe > 0 ? sharpe.toFixed(2) : '—') + '</span></td>';
                    html += '<td style="font-size:11px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(s.entry_condition || '-') + '</td>';
                    html += '<td style="font-family:var(--font-mono);font-size:11px">' + (s.entry_price ? '$' + s.entry_price.toLocaleString() : '—') + '</td>';
                    html += '</tr>';
                });
                stratTbody.innerHTML = html;
            }
        }
        var btcPrice = liveData.btc_price;
        var ind = liveData.indicators || {};
        window._currentIndicators = ind;
        lastSuccessfulUpdate = new Date();
        updateBadge('', '更新於 ' + formatTime(lastSuccessfulUpdate));
        renderMarketSentiment(ind);
        if (btcPrice) {
            var chartPriceEl = document.getElementById('chart-price');
            if (chartPriceEl) {
                chartPriceEl.textContent = fmtPrice(btcPrice);
                chartPriceEl.className = 'chart-price';
            }
        }
    })
    .catch(function(e) {
        updateBadge('stale', '更新失敗');
    });
}

// ── Chart ──
function initChart() {
    var container = document.getElementById('chart-container');
    var volContainer = document.getElementById('chart-container-vol');
    if (!container) return;
    if (chart) { chart.remove(); chart = null; }
    chart = LightweightCharts.createChart(container, {
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
    candleSeries = chart.addCandlestickSeries({
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
            if (chart && range && range.left != null && range.right != null) chart.timeScale().setVisibleLogicalRange(range);
        });
        chart.timeScale().subscribeVisibleTimeRangeChange(function(range) {
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
        if (chart && container) {
            chart.applyOptions({ width: container.clientWidth });
        }
        if (window.volChart && volContainer) {
            window.volChart.applyOptions({ width: volContainer.clientWidth });
        }
    };
    window.addEventListener('resize', _chartResizeHandler);
}

function loadChartData(sym, tf) {
    sym = sym || currentSym;
    tf = tf || currentTF;
    var isTWSE = (currentMarket === 'TWSE');
    var url = isTWSE
        ? API_BASE + '/twse/klines/' + sym + '?interval=' + tf + '&limit=300'
        : API_BASE + '/klines?symbol=' + sym.toUpperCase().replace('USDT', '') + '&interval=' + tf + '&limit=300';

    fetch(url)
        .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function(data) {
            if (!data || !data.length) return;
            // Filter out invalid time entries
            data = data.filter(function(d) { return d.time != null && d.time !== undefined; });
            if (!data.length) return;
            // Normalize time: Unix timestamp (seconds) -> YYYY-MM-DD string for lightweight-charts v4
            function normTime(t) {
                if (t == null) return null;
                if (typeof t === 'number') {
                    // lightweight-charts v4 accepts Unix timestamp in seconds (integer)
                    // BTC 4h klines: multiple bars per day, need time-of-day precision
                    // Return Unix timestamp in SECONDS (not date string, not ms)
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
            // Build volume histogram data
            var vdata = data.map(function(d) {
                var vol = parseFloat(d.volume) || 0;
                var color = '#58A6FF';
                if (d.close && d.open) {
                    color = parseFloat(d.close) >= parseFloat(d.open) ? 'rgba(63,185,80,0.7)' : 'rgba(248,81,73,0.7)';
                }
                return { time: normTime(d.time), value: vol, color: color };
            });
            window._chartCandleData = cdata;  // store for MA/RSI overlay
            if (candleSeries) candleSeries.setData(cdata);
            if (window.volSeries) window.volSeries.setData(vdata);
            if (chart) chart.timeScale().fitContent();
            if (window.volChart) window.volChart.timeScale().fitContent();

            if (isTWSE) {
                // Show TWSE stock code as symbol
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
                    priceEl.textContent = fmtPrice(last.close);
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
                    chgEl.textContent = fmtPct(pct);
                    chgEl.className = pct >= 0 ? 'up' : 'dn';
                }
            }
        })
        .catch(function(e) {
            console.error('chart error', e);
        });
}

// ── Tab Switching ──
function switchTab(tab) {
    // Hide all tab content
    document.querySelectorAll('.tab-content').forEach(function(el) { el.style.display = 'none'; });
    // Reset all tab buttons
    document.querySelectorAll('#tab-bar button, [id^="tab-btn-"]').forEach(function(el) {
        el.style.background = '';
        el.style.color = 'var(--text-muted)';
    });
    // Show selected tab content
    var tabEl = document.getElementById('tab-' + tab);
    if (tabEl) tabEl.style.display = 'block';
    // Highlight active tab button
    var btnEl = document.getElementById('tab-btn-' + tab);
    if (btnEl) { btnEl.style.background = '#333'; btnEl.style.color = '#fff'; }
}

    // Crypto TF buttons
    document.querySelectorAll('#crypto-tf-buttons .tf-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#crypto-tf-buttons .tf-btn').forEach(function(b){ b.classList.remove('active'); });
            btn.classList.add('active');
            currentTF = btn.dataset.tf;
            loadChartData(currentSym, currentTF);
        });
    });

    // TWSE TF buttons
    document.querySelectorAll('#twse-tf-buttons .tf-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#twse-tf-buttons .tf-btn').forEach(function(b){ b.classList.remove('active'); });
            btn.classList.add('active');
            var twseTf = btn.dataset.tf;
            loadTWSEChart(currentTWSEStock, twseTf);
        });
    });

    // Initialize on page load (wait for DOM ready)
    document.addEventListener('DOMContentLoaded', function() {
        switchMarket('CRYPTO');
        loadStrategies();
        loadAnomalies();
    });
    // Fallback: run immediately if DOM already loaded
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(function() {
            switchMarket('CRYPTO');
            loadStrategies();
            loadAnomalies();
        }, 10);
    }

    // Stale check with auto-retry
    setInterval(function() {
        if (lastSuccessfulUpdate) {
            var elapsed = Math.floor((Date.now() - lastSuccessfulUpdate.getTime()) / 1000);
            if (elapsed > 90) {
                updateBadge('stale', '逾期 ' + Math.floor(elapsed/60) + 'm');
                loadStrategies();
                loadAnomalies();
            }
        }
    }, 30000);

    // ESC key closes modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeStrategyModal();
    });

    // Document-level click listener for strategy table rows (fallback if inline onclick fails)
    document.addEventListener('click', function(e) {
        var tr = e.target.closest('tr[data-sid]');
        if (tr) {
            var id = tr.getAttribute('data-sid');
            if (id) openStrategyModalById(id);
        }
    });
