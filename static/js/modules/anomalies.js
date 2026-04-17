// ── Anomaly Panels Module ──

export function renderAnomalyPanels(data) {
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
    var volHtml = '';
    var allVols = data.volume_anomalies || volAnomalies;
    allVols.forEach(function(v) {
        var ratioClass = v.severity === 'critical' ? 'critical' : v.severity === 'warning' ? 'warning' : 'normal';
        volHtml += '<div class="anomaly-row">';
        volHtml += '<span class="anomaly-row-icon">' + (v.emoji || '✅') + '</span>';
        volHtml += '<span class="anomaly-row-sym">' + v.symbol + '</span>';
        volHtml += '<span class="anomaly-row-ratio ' + ratioClass + '">' + v.ratio + 'x</span>';
        volHtml += '<span class="anomaly-row-detail">' + (v.today_volume ? window.fmtNum(v.today_volume) : (v.avg_volume ? '均' + window.fmtNum(v.avg_volume) : '')) + '</span>';
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
    var obHtml = '';
    obAnomalies.slice(0, 20).forEach(function(o) {
        var ratioClass = o.severity === 'critical' ? 'critical' : o.severity === 'warning' ? 'warning' : 'normal';
        var bidsTxt = o.current_bids > 0 ? ('均' + window.fmtNum(o.avg_bids)) : '—';
        obHtml += '<div class="anomaly-row">';
        obHtml += '<span class="anomaly-row-icon">' + (o.emoji || '✅') + '</span>';
        obHtml += '<span class="anomaly-row-sym">' + o.symbol + '</span>';
        obHtml += '<span class="anomaly-row-ratio ' + ratioClass + '">' + o.ratio + 'x</span>';
        obHtml += '<span class="anomaly-row-detail">' + bidsTxt + '</span>';
        obHtml += '</div>';
    });
    if (obHtml) obList.innerHTML = obHtml;
}

export function loadAnomalies() {
    fetch(window.API_BASE + '/dashboard/anomalies')
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

export function renderTwseAnomalies(data) {
    var list = document.getElementById('twse-anom-list');
    var anomalies = data && data.anomalies ? data.anomalies : [];
    var total = (data && data.total) || 0;
    var critical = (data && data.critical_count) || 0;
    var warning = (data && data.warning_count) || 0;
    var statusLight = document.getElementById('twse-anom-status-light');
    var statusDot = document.getElementById('twse-anom-status-dot');
    var statusText = document.getElementById('twse-anom-status-text');
    var badge = document.getElementById('twse-anom-count-badge');

    if (!list) { return; }

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

export function loadTwseAnomalies() {
    fetch(window.API_BASE + '/twse/anomalies/realtime')
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

window._twseAnomTimer = null;
export function startTwseAnomTimer() {
    if (window._twseAnomTimer) clearInterval(window._twseAnomTimer);
    loadTwseAnomalies();
    window._twseAnomTimer = setInterval(loadTwseAnomalies, 60000);
}
