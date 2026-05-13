/**
 * 试次累积与汇总指标生成。
 *
 *  - 每个试次构造一条 TrialRecord（字段命名与后端 model 一一对应）
 *  - 试次编号在练习与正式阶段分别从 1 重新计数
 *  - 汇总指标按文档 §10.3：
 *      finalThresholdMs / asAcc&Rt 在 last5-reversal 窗口 / 全部正式 AS&PS 准确率与平均 RT
 */
(function () {
    'use strict';

    function nowIso() {
        return new Date().toISOString();
    }

    function mean(arr) {
        if (!arr.length) return null;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    function round1(v) {
        return v == null ? null : Math.round(v * 10) / 10;
    }

    class Recorder {
        constructor(subjectId) {
            this.subjectId = subjectId;
            this.startTime = nowIso();
            this.trials = [];                    // 全部试次（练习+正式）
            this.formalStartIndex = null;        // 正式第一条在 trials 中的索引
            this.last5WindowStartTrialNumber = null;  // 正式 trial_number 的起点
        }

        markFormalStart() {
            this.formalStartIndex = this.trials.length;
        }

        push(record) {
            this.trials.push(record);
        }

        /**
         * 在最后 5 个 reversal 时记录"窗口起点"——
         * 取 reversalSoas 数组开始记录"最后 5 个 reversal 的第 1 个" 时的 trialNumber。
         * 实际实现：由调用方在 reversalCount === targetReversals - 5 + 1 时调用。
         *
         * 但为了简化，我们事后在 buildSummary 时根据 trials 中标记的 reversal 反推：
         * 第 (totalReversals - 5 + 1) 个 reversal 试次为窗口起点。
         */

        _formalTrials() {
            if (this.formalStartIndex == null) return [];
            return this.trials.slice(this.formalStartIndex);
        }

        /**
         * 计算汇总指标。
         * @param {object} ctrl - AdaptiveController 实例（用于阈值与 reversal 数）
         */
        buildSummary(ctrl) {
            const formal = this._formalTrials();
            const asTrials = formal.filter(t => t.trial_type === 'AS');
            const psTrials = formal.filter(t => t.trial_type === 'PS');

            const { thresholdMs, last5 } = ctrl.computeThreshold();

            // 定位最后 5 reversal 窗口的起点：第 (N-4) 个 reversal 的 trial_number
            const reversalTrialNumbers = formal
                .filter(t => t.is_reversal)
                .map(t => t.trial_number);
            let windowStart = null;
            if (reversalTrialNumbers.length >= 5) {
                windowStart = reversalTrialNumbers[reversalTrialNumbers.length - 5];
            } else if (reversalTrialNumbers.length > 0) {
                windowStart = reversalTrialNumbers[0];
            }

            const inWindow = windowStart == null
                ? []
                : formal.filter(t => t.trial_number >= windowStart);
            const asInWindow = inWindow.filter(t => t.trial_type === 'AS');

            return {
                subjectId: this.subjectId,
                startTime: this.startTime,
                endTime: nowIso(),
                totalTrials: this.trials.length,
                totalReversals: ctrl.getReversalCount(),

                finalThresholdMs: round1(thresholdMs),
                last5ReversalSoas: last5,

                asAccuracyInLast5ReversalWindow: round1(accuracyPct(asInWindow)),
                asMeanRtInLast5ReversalWindow:  round1(meanValidRt(asInWindow)),

                asAccuracyOverall: round1(accuracyPct(asTrials)),
                asMeanRtOverall:   round1(meanValidRt(asTrials)),

                psAccuracyOverall: round1(accuracyPct(psTrials)),
                psMeanRtOverall:   round1(meanValidRt(psTrials))
            };
        }
    }

    function accuracyPct(trials) {
        if (!trials.length) return null;
        const c = trials.filter(t => t.is_correct).length;
        return c * 100 / trials.length;
    }

    function meanValidRt(trials) {
        const rts = trials
            .filter(t => t.RT_valid && t.RT_ms != null)
            .map(t => t.RT_ms);
        return mean(rts);
    }

    window.RecorderModule = { Recorder };
})();
