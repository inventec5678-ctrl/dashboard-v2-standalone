// ── API Module ──
// All backend fetch calls, returning parsed JSON.
// Rendering logic stays in the respective feature modules.

export function fetchCryptoKlines(sym, tf, limit) {
    limit = limit || 300;
    var url = window.API_BASE + '/klines?symbol=' + sym.toUpperCase().replace('USDT', '') + '&interval=' + tf + '&limit=' + limit;
    return fetch(url).then(function(r) {
        if (!r.ok) return Promise.reject(r.status);
        return r.json();
    });
}

export function fetchTWSEKlines(code, tf, limit) {
    limit = limit || 300;
    var url = window.API_BASE + '/twse/klines/' + code + '?interval=' + tf + '&limit=' + limit;
    return fetch(url).then(function(r) {
        if (!r.ok) return Promise.reject(r.status);
        return r.json();
    });
}

export function fetchTWSEQuote(stockCode) {
    var url = window.API_BASE + '/twse/quote/' + stockCode;
    return fetch(url).then(function(r) {
        if (!r.ok) return Promise.reject(r.status);
        return r.json();
    });
}

export function fetchTWSESearch(q) {
    var url = window.API_BASE + '/twse/search?q=' + encodeURIComponent(q);
    return fetch(url).then(function(r) {
        if (!r.ok) return Promise.reject(r.status);
        return r.json();
    });
}

export function fetchStrategiesLive() {
    return fetch(window.API_BASE + '/strategies/live').then(function(r) {
        if (!r.ok) return Promise.reject(r.status);
        return r.json();
    });
}

export function fetchStrategiesAll() {
    return fetch(window.API_BASE + '/strategies/all').then(function(r) {
        if (!r.ok) return Promise.reject(r.status);
        return r.json();
    });
}

export function fetchCryptoAnomalies() {
    return fetch(window.API_BASE + '/dashboard/anomalies').then(function(r) {
        if (!r.ok) return Promise.reject(r.status);
        return r.json();
    });
}

export function fetchTWSEAnomalies() {
    return fetch(window.API_BASE + '/twse/anomalies/realtime').then(function(r) {
        if (!r.ok) return Promise.reject(r.status);
        return r.json();
    });
}

export function fetchSymbolsCrypto() {
    // Returns list of available crypto symbols (exposed as named export for completeness)
    return Promise.resolve([]);
}
