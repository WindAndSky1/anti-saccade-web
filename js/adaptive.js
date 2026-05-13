/**
 * 自适应 SOA 控制器（严格遵循开发文档 §8、§9）。
 *
 *  - 仅 AS 试次触发 SOA 更新；PS 试次 SOA 不变、不参与 Rule B/C 计数
 *  - Rule A：本次 AS 正确 −10，错误/超时 +10
 *  - Rule B：连续 3 个 AS 全正确再额外 −10，全错误再额外 +10；触发后连续计数清零
 *  - Rule C：最近 25 个 AS 准确率 > 78% 额外 −10，< 72% 额外 +10
 *  - SOA 钳位 [minSoaMs, maxSoaMs]
 *  - Reversal：本次总调整方向与上一次"有变化方向"相反时计入一次 reversal
 *    （调整量为 0 不视为方向变化，不计 reversal）
 *  - 终止：达到 targetReversals
 *  - 阈值：丢弃前 2 个 reversal，取剩余中"最后 5 个" reversal 对应 SOA 的算术平均
 */
(function () {
    'use strict';

    class AdaptiveController {

        constructor(cfg) {
            this.minSoa = cfg.minSoaMs;
            this.maxSoa = cfg.maxSoaMs;
            this.targetReversals = cfg.targetReversals;

            this.soa = cfg.initialSoaMs;          // 当前生效的 SOA（即下一个 AS 试次将使用）
            this.asResults = [];                  // 只记录 AS 的对错（boolean[]）
            this.correctStreak = 0;
            this.incorrectStreak = 0;

            this.lastNonzeroDir = 0;              // -1 | 0 | +1
            this.reversalCount = 0;
            this.reversalSoas = [];               // 每次 reversal 记录的 SOA（调整前）
        }

        currentSoa() { return this.soa; }
        getReversalCount() { return this.reversalCount; }
        isTerminated() { return this.reversalCount >= this.targetReversals; }

        /**
         * 处理一次 AS 试次的结果，返回本次试次的调整明细与下一个 SOA。
         * 注意：传入的 currentSoa 应等于本次 AS 试次实际呈现的 SOA。
         */
        recordAs(isCorrect, currentSoa) {
            this.asResults.push(!!isCorrect);

            // ===== Rule A =====
            const ruleA = isCorrect ? -10 : +10;

            // ===== Rule B（连续 3 同向）=====
            let ruleB = 0;
            let ruleBTriggered = false;
            if (isCorrect) {
                this.correctStreak += 1;
                this.incorrectStreak = 0;
                if (this.correctStreak >= 3) {
                    ruleB = -10;
                    ruleBTriggered = true;
                    this.correctStreak = 0;
                }
            } else {
                this.incorrectStreak += 1;
                this.correctStreak = 0;
                if (this.incorrectStreak >= 3) {
                    ruleB = +10;
                    ruleBTriggered = true;
                    this.incorrectStreak = 0;
                }
            }

            // ===== Rule C（最近 25 窗口）=====
            let ruleC = 0;
            let ruleCTriggered = false;
            if (this.asResults.length >= 25) {
                const last25 = this.asResults.slice(-25);
                const acc = last25.filter(x => x).length / 25;
                if (acc > 0.78) {
                    ruleC = -10;
                    ruleCTriggered = true;
                } else if (acc < 0.72) {
                    ruleC = +10;
                    ruleCTriggered = true;
                }
            }

            const total = ruleA + ruleB + ruleC;

            // ===== Reversal 判定（调整方向变化）=====
            const dir = total > 0 ? +1 : (total < 0 ? -1 : 0);
            let isReversal = false;
            if (dir !== 0) {
                if (this.lastNonzeroDir !== 0 && dir !== this.lastNonzeroDir) {
                    isReversal = true;
                    this.reversalCount += 1;
                    this.reversalSoas.push(currentSoa);
                }
                this.lastNonzeroDir = dir;
            }

            // ===== 钳位 =====
            const newSoa = Math.max(this.minSoa, Math.min(this.maxSoa, this.soa + total));
            this.soa = newSoa;

            return {
                ruleAAdjustment: ruleA,
                ruleBTriggered, ruleBAdjustment: ruleB,
                ruleCTriggered, ruleCAdjustment: ruleC,
                totalAdjustment: total,
                nextSoaMs: newSoa,
                isReversal,
                reversalCount: this.reversalCount
            };
        }

        /**
         * 计算最终阈值：丢弃前 2 个 reversal，取最后 5 个的算术平均。
         * 不足 5 个时退化为已记录 reversal 的均值；为空返回 null。
         */
        computeThreshold() {
            const r = this.reversalSoas;
            if (r.length === 0) return { thresholdMs: null, last5: [] };
            const afterDrop = r.length > 2 ? r.slice(2) : r.slice();
            const last5 = afterDrop.slice(-5);
            const mean = last5.reduce((a, b) => a + b, 0) / last5.length;
            return { thresholdMs: mean, last5: last5.slice() };
        }
    }

    window.Adaptive = { AdaptiveController };
})();
