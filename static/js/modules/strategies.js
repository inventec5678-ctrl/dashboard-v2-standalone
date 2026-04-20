// ── Strategies Module ──

// Global state for strategy ranking
window._rankStrategies = [];
window._allStrategies = [];
window._rankSortKey = 'win_rate';
window._rankSortAsc = false;
window._consensusStrategies = [];

export function computeConsensus(strategies) {
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
        if (arr.length === 1) return { zone: window.fmtPrice(min), range: '' };
        return { zone: window.fmtPrice(min) + ' – ' + window.fmtPrice(max), range: '(' + arr.length + '筆)' };
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

export function renderStrategyOverview(strategies) {
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

export function renderRankingTable(strategies) {
    window._rankStrategies = strategies || [];
    window.doRankSort();
}

export function rankSetSort(key) {
    if (window._rankSortKey === key) {
        window._rankSortAsc = !window._rankSortAsc;
    } else {
        window._rankSortKey = key;
        window._rankSortAsc = key === 'max_drawdown';
    }
    document.querySelectorAll('.rank-sort-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.sort === key);
    });
    window.doRankSort();
}

export function doRankSort() {
    var key = window._rankSortKey;
    var asc = window._rankSortAsc;
    var sorted = window._rankStrategies.slice().sort(function(a, b) {
        var va = a[key], vb = b[key];
        if (typeof va === 'string') {
            return asc ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        return asc ? (va || 0) - (vb || 0) : (vb || 0) - (va || 0);
    });
    var tbody = document.getElementById('strategy-rank-tbody');
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

        html += '<tr class="' + rowClass + '" data-sid="' + window.escHtml(s.strategy_id) + '" title="點擊查看詳情">';
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
        html += '<td><span class="rank-entry">' + window.fmtPrice(s.entry_price) + '</span></td>';
        html += '</tr>';
    });
    tbody.innerHTML = html;
}

export function loadStrategies() {
    Promise.all([
        fetch(window.API_BASE + '/strategies/live').then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); }),
        fetch(window.API_BASE + '/strategies/all').then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
    ])
    .then(function(results) {
        var liveData = results[0];
        var allData = results[1];
        var liveStrategies = liveData.strategies || [];
        var allStrategies = allData.strategies || [];
        var liveMetrics = {};
        var allStrategiesMap = {};
        allStrategies.forEach(function(s) { allStrategiesMap[s.strategy_id] = s; });
        liveStrategies.forEach(function(s) {
            liveMetrics[s.strategy_id] = s;
            if (allStrategiesMap[s.strategy_id] && allStrategiesMap[s.strategy_id].params) {
                s.params = allStrategiesMap[s.strategy_id].params;
            }
        });
        var combined = [];
        var seen = {};
        liveStrategies.forEach(function(s) {
            if (!seen[s.strategy_id]) {
                seen[s.strategy_id] = true;
                combined.push(s);
            }
        });
        allStrategies.forEach(function(s) {
            if (!seen[s.strategy_id] && (s.win_rate || 0) > 0) {
                seen[s.strategy_id] = true;
                combined.push(s);
            }
        });
        window._allStrategies = combined;
        renderStrategyOverview(combined);
        window.renderMarketSentiment(liveData.indicators || {});
        renderRankingTable(combined);

        // Also render to strategy tab tbody
        var stratTbody = document.getElementById('strategy-rank-tbody');
        if (stratTbody) {
            var key = window._rankSortKey;
            var asc = window._rankSortAsc;
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
                    html += '<tr class="' + rankClass + '" data-sid="' + window.escHtml(s.strategy_id) + '" onclick="openStrategyModalById(this.dataset.sid)" style="cursor:pointer" title="查看策略詳情">';
                    html += '<td>' + rank + '</td>';
                    html += '<td><span class="dir-badge ' + badgeClass + '">' + dirIcon + '</span> ' + window.escHtml(s.name || s.strategy_id) + '</td>';
                    html += '<td>' + (s.timeframe || '-') + '</td>';
                    html += '<td>' + dir + '</td>';
                    html += '<td><span class="metric-badge ' + matchClass + '">' + matchPct.toFixed(1) + '%</span></td>';
                    html += '<td><span class="metric-badge ' + wrClass + '">' + (wr >= 0 ? wr.toFixed(1) + '%' : '—') + '</span></td>';
                    html += '<td>' + (pf > 0 ? pf.toFixed(2) : '—') + '</td>';
                    html += '<td><span class="metric-badge ' + ddClass + '">' + (dd > 0 ? dd.toFixed(1) + '%' : '—') + '</span></td>';
                    html += '<td><span class="metric-badge ' + sharpeClass + '">' + (sharpe > 0 ? sharpe.toFixed(2) : '—') + '</span></td>';
                    html += '<td style="font-size:11px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + window.escHtml(s.entry_condition || '-') + '</td>';
                    html += '<td style="font-family:var(--font-mono);font-size:11px">' + (s.entry_price ? '$' + s.entry_price.toLocaleString() : '—') + '</td>';
                    html += '</tr>';
                });
                stratTbody.innerHTML = html;
            }
        }

        var ind = liveData.indicators || {};
        window._currentIndicators = ind;
        window.lastSuccessfulUpdate = new Date();
        window.updateBadge('', '更新於 ' + window.formatTime(window.lastSuccessfulUpdate));
        if (window.startCountdown) window.startCountdown();
        if (liveData.btc_price) {
            var chartPriceEl = document.getElementById('chart-price');
            if (chartPriceEl) {
                chartPriceEl.textContent = window.fmtPrice(liveData.btc_price);
                chartPriceEl.className = 'chart-price';
            }
        }
    })
    .catch(function(e) {
        window.updateBadge('stale', '更新失敗');
    });
}
