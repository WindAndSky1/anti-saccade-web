/**
 * 与后端通信：POST /api/session/save
 * 失败重试 2 次，每次间隔 1 秒。仍失败则抛出错误，由 main.js 进入兜底页。
 */
(function () {
    'use strict';

    async function postJson(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => '');
            throw new Error('HTTP ' + res.status + ' ' + txt);
        }
        return res.json();
    }

    async function saveWithRetry(payload, maxRetries = 2, delayMs = 1000) {
        let lastErr;
        for (let i = 0; i <= maxRetries; i++) {
            try {
                return await postJson('/api/session/save', payload);
            } catch (e) {
                lastErr = e;
                if (i < maxRetries) await new Promise(r => setTimeout(r, delayMs));
            }
        }
        throw lastErr;
    }

    window.Api = { save: saveWithRetry };
})();
