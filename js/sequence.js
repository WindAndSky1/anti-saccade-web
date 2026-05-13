/**
 * AS/PS 伪随机序列生成。
 *
 * 策略：
 *   - 块大小 20，AS:PS = 10:10
 *   - Fisher–Yates 打乱
 *   - 若任意 4 个连续同类型则重洗（约束：最大连续长度 ≤ 3）
 *   - 练习阶段一次生成 1 块（20 个）；正式阶段按需追加，直到 reversal 终止
 */
(function () {
    'use strict';

    const BLOCK_SIZE = 20;
    const HALF = BLOCK_SIZE / 2;
    const MAX_RUN = 3;
    const MAX_RESHUFFLE = 500;

    function fisherYates(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function maxRunLength(arr) {
        let max = 1, cur = 1;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] === arr[i - 1]) {
                cur++;
                if (cur > max) max = cur;
            } else {
                cur = 1;
            }
        }
        return max;
    }

    function buildBlock(prevTail) {
        const base = new Array(HALF).fill('AS').concat(new Array(HALF).fill('PS'));
        for (let attempt = 0; attempt < MAX_RESHUFFLE; attempt++) {
            fisherYates(base);
            const probe = prevTail ? prevTail.concat(base) : base;
            if (maxRunLength(probe) <= MAX_RUN) {
                return base.slice();
            }
        }
        // 兜底：在最大尝试次数仍不满足时，直接返回末次结果
        return base.slice();
    }

    /**
     * SequenceGenerator：分块发射 AS/PS。
     *   const gen = new SequenceGenerator();
     *   gen.next() // → 'AS' | 'PS'
     */
    class SequenceGenerator {
        constructor() {
            this.queue = [];
            this.lastBlockTail = null;
        }

        _refill() {
            const seed = this.lastBlockTail ? this.lastBlockTail.slice(-MAX_RUN) : null;
            const block = buildBlock(seed);
            this.queue.push(...block);
            this.lastBlockTail = block;
        }

        next() {
            if (this.queue.length === 0) this._refill();
            return this.queue.shift();
        }

        takeMany(n) {
            const out = [];
            while (out.length < n) out.push(this.next());
            return out;
        }
    }

    function pickSide() { return Math.random() < 0.5 ? 'left' : 'right'; }
    function pickLetter() { return Math.random() < 0.5 ? 'Q' : 'O'; }

    window.Sequence = { SequenceGenerator, pickSide, pickLetter };
})();
