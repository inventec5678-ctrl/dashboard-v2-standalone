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

export async function fetchUSKlines(symbol, interval, limit = 300) {
    // GET /api/us/klines/{symbol}?interval=1d&limit=300
    const resp = await fetch(`${window.API_BASE}/us/klines/${symbol}?interval=${interval}&limit=${limit}`);
    if (!resp.ok) return Promise.reject(resp.status);
    return resp.json();
}

export async function fetchUSQuote(symbol) {
    // GET /api/us/quote/{symbol}
    const resp = await fetch(`${window.API_BASE}/us/quote/${symbol}`);
    return resp.json();
}

export async function fetchUSSymbols() {
    // GET /api/symbols/us
    const resp = await fetch(`${window.API_BASE}/symbols/us`);
    return resp.json();
}

export async function loadUSOHLCV(symbol, interval) {
    const data = await fetchUSKlines(symbol, interval);
    if (!data || !data.klines) return [];
    return data.klines.map(function(d) {
        return {
            time: d[0],
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5])
        };
    });
}

export function fetchSymbolsCrypto() {
    // Returns list of available crypto symbols (exposed as named export for completeness)
    return Promise.resolve([]);
}
