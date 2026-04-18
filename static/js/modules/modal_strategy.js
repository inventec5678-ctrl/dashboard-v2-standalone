// ── Modal / Strategy Detail Module ──

window._activePriceLines = {};
window._activeModalStrategy = null;
window._currentStrategy = null;

export function _doRenderModal(s) {
    var dir = s.direction || 'LONG';
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
                <div class="modal-price-card"><div class="modal-price-label">進場價</div><div class="modal-price-value entry">' + window.fmtPrice(s.entry_price) + '</div><button class="copy-btn" onclick="window.copyPrice(this, \'' + s.entry_price + '\')">複製</button></div>\
                <div class="modal-price-card"><div class="modal-price-label">止盈</div><div class="modal-price-value tp">' + window.fmtPrice(s.take_profit) + '</div><button class="copy-btn" onclick="window.copyPrice(this, \'' + s.take_profit + '\')">複製</button></div>\
                <div class="modal-price-card"><div class="modal-price-label">止損</div><div class="modal-price-value sl">' + window.fmtPrice(s.stop_loss) + '</div><button class="copy-btn" onclick="window.copyPrice(this, \'' + s.stop_loss + '\')">複製</button></div>\
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
                <button class="modal-chart-btn" onclick="window.togglePriceLine(\'entry\')">📍 進場線</button>\
                <button class="modal-chart-btn" onclick="window.togglePriceLine(\'tp\')">🎯 止盈線</button>\
                <button class="modal-chart-btn" onclick="window.togglePriceLine(\'sl\')">🛡 止損線</button>\
                <button class="modal-chart-btn" onclick="window.togglePriceLine(\'ma\')">📈 MA</button>\
                <button class="modal-chart-btn" onclick="window.togglePriceLine(\'rsi\')">📊 RSI</button>\
                <button class="modal-chart-btn" onclick="window.clearPriceLines()">清除</button>\
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

    // Build entry conditions
    var entryConditions = [];
    var p = s.params || s.parameters || {};
    var dirUpper = (s.direction || 'LONG').toUpperCase();
    var condObj = dirUpper === 'SHORT' ? (p.short || p) : (p.long || p);
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
    window.clearPriceLines();
    document.getElementById('modal-title').textContent = s.name || '策略詳情';
    document.getElementById('strategy-modal').classList.add('open');
}

export function openStrategyModalById(id) {
    var s = null;
    for (var i = 0; i < window._allStrategies.length; i++) {
        if (window._allStrategies[i].strategy_id === id) {
            s = window._allStrategies[i];
            break;
        }
    }
    if (!s) {
        for (var i = 0; i < window._rankStrategies.length; i++) {
            if (window._rankStrategies[i].strategy_id === id) {
                s = window._rankStrategies[i];
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

export function closeStrategyModal() {
    document.getElementById('strategy-modal').classList.remove('open');
}

export function clearPriceLines() {
    if (!window._activePriceLines) window._activePriceLines = {};
    for (var k in window._activePriceLines) {
        if (window._activePriceLines[k]) {
            if (window[window.currentMarket + 'Chart'] && window[window.currentMarket + 'Chart'].removeLineMarker) {
                window[window.currentMarket + 'Chart'].removeLineMarker(window._activePriceLines[k]);
            }
        }
    }
    window._activePriceLines = {};
}

export function togglePriceLine(type) {
    var s = window._activeModalStrategy;
    if (!s) return;
    if (!window[window.currentMarket + 'Chart']) return;
    if (!window._activePriceLines) window._activePriceLines = {};

    // Remove existing line of this type
    if (window._activePriceLines[type]) {
        if (window[window.currentMarket + 'Chart'].removeLineMarker) {
            window[window.currentMarket + 'Chart'].removeLineMarker(window._activePriceLines[type]);
        }
        window._activePriceLines[type] = null;
        return;
    }

    var price = null;
    var color = '#58A6FF';
    var title = '';
    if (type === 'entry') { price = s.entry_price; color = '#58A6FF'; title = '進場'; }
    else if (type === 'tp') { price = s.take_profit; color = '#3FB950'; title = '止盈'; }
    else if (type === 'sl') { price = s.stop_loss; color = '#F85149'; title = '止損'; }
    else if (type === 'ma') { price = null; }
    else if (type === 'rsi') { price = null; }

    if (price != null && window[window.currentMarket + 'CandleSeries']) {
        var lastBar = window[window.currentMarket + 'CandleSeries'].data ? window[window.currentMarket + 'CandleSeries'].data().slice(-1)[0] : null;
        if (lastBar) {
            // Use lightweight-charts built-in price line via createPriceLine
            try {
                var line = window[window.currentMarket + 'CandleSeries'].createPriceLine({
                    price: price,
                    color: color,
                    lineWidth: 1,
                    lineStyle: 2, // Dashed
                    axisLabelVisible: true,
                    title: title,
                });
                window._activePriceLines[type] = line;
            } catch(e) {
                console.warn('Price line error', e);
            }
        }
    }
}
