/**
 * 阶段调度入口。
 *   指导语 → 练习 20 次（SOA 固定 120 ms，有反馈）
 *      → ready? → 正式（自适应 SOA，至 16 reversal 终止）
 *      → 上传数据 → 跳回 returnUrl（缺失则 window.close()）
 */
(function () {
    'use strict';

    const cfg = window.AS_CONFIG;

    function $(id) { return document.getElementById(id); }
    function showOverlay(id) {
        document.querySelectorAll('.overlay').forEach(el => el.classList.remove('show'));
        if (id) $(id).classList.add('show');
    }

    function waitForSpace() {
        return new Promise(resolve => {
            const onKey = (e) => {
                if (e.code === 'Space') {
                    document.removeEventListener('keydown', onKey);
                    e.preventDefault();
                    resolve();
                }
            };
            document.addEventListener('keydown', onKey);
        });
    }

    async function runPractice(recorder) {
        showOverlay(null);

        const gen = new window.Sequence.SequenceGenerator();
        const types = gen.takeMany(cfg.practiceTrials);

        for (let i = 0; i < types.length; i++) {
            const rec = await window.Trial.runTrial({
                phase: 'practice',
                trialNumber: i + 1,
                trialType: types[i],
                currentSoaMs: cfg.initialSoaMs,
                responseTimeoutMs: cfg.responseTimeoutMs,
                showFeedback: true
            });

            // 练习阶段不写自适应字段，按文档要求仍记录到数据
            recorder.push(fillNeutralAdaptiveFields(rec, cfg.initialSoaMs));
        }
    }

    function fillNeutralAdaptiveFields(rec, soaForRow) {
        rec.rule_A_adjustment = 0;
        rec.rule_B_triggered = false;
        rec.rule_B_adjustment = 0;
        rec.rule_C_triggered = false;
        rec.rule_C_adjustment = 0;
        rec.total_adjustment = 0;
        rec.next_SOA_ms = soaForRow;
        rec.is_reversal = false;
        rec.reversal_count = 0;
        return rec;
    }

    async function runFormal(recorder) {
        showOverlay(null);
        recorder.markFormalStart();

        const ctrl = new window.Adaptive.AdaptiveController(cfg);
        const gen = new window.Sequence.SequenceGenerator();
        let trialNo = 0;

        while (!ctrl.isTerminated()) {
            trialNo += 1;
            const type = gen.next();
            const soaForThisTrial = ctrl.currentSoa();

            const partial = await window.Trial.runTrial({
                phase: 'formal',
                trialNumber: trialNo,
                trialType: type,
                currentSoaMs: soaForThisTrial,
                responseTimeoutMs: cfg.responseTimeoutMs,
                showFeedback: false
            });

            if (type === 'AS') {
                const upd = ctrl.recordAs(partial.is_correct, soaForThisTrial);
                partial.rule_A_adjustment = upd.ruleAAdjustment;
                partial.rule_B_triggered  = upd.ruleBTriggered;
                partial.rule_B_adjustment = upd.ruleBAdjustment;
                partial.rule_C_triggered  = upd.ruleCTriggered;
                partial.rule_C_adjustment = upd.ruleCAdjustment;
                partial.total_adjustment  = upd.totalAdjustment;
                partial.next_SOA_ms       = upd.nextSoaMs;
                partial.is_reversal       = upd.isReversal;
                partial.reversal_count    = upd.reversalCount;
            } else {
                // PS：SOA、reversal 计数与各 rule 均不变
                fillNeutralAdaptiveFields(partial, ctrl.currentSoa());
                partial.reversal_count = ctrl.getReversalCount();
            }

            recorder.push(partial);
        }

        return ctrl;
    }

    function leaveToReturnUrl() {
        if (cfg.returnUrl && cfg.returnUrl.trim()) {
            window.location.href = cfg.returnUrl;
        } else {
            window.close();
            // 若无法关闭（独立浏览器进程），退化为空白
            document.body.innerHTML = '<div style="color:#888;text-align:center;margin-top:40vh;font-family:sans-serif;">实验已结束，可关闭此窗口。</div>';
        }
    }

    async function uploadAndLeave(recorder, ctrl) {
        const payload = {
            subjectId: cfg.subjectId,
            trials: recorder.trials,
            summary: recorder.buildSummary(ctrl)
        };

        showOverlay('uploading');

        try {
            await window.Api.save(payload);
            leaveToReturnUrl();
        } catch (err) {
            console.error('Upload failed', err);
            $('upload-fail-text').value = JSON.stringify(payload, null, 2);
            $('retry-upload').onclick = async () => {
                showOverlay('uploading');
                try {
                    await window.Api.save(payload);
                    leaveToReturnUrl();
                } catch (e2) {
                    showOverlay('upload-fail');
                }
            };
            showOverlay('upload-fail');
        }
    }

    async function bootstrap() {
        // 应用视角→像素换算
        window.Geometry.apply(cfg);

        const recorder = new window.RecorderModule.Recorder(cfg.subjectId);

        // 指导语
        showOverlay('intro');
        await waitForSpace();

        // 练习
        await runPractice(recorder);

        // ready?
        showOverlay('ready');
        await waitForSpace();

        // 正式
        const ctrl = await runFormal(recorder);

        // 上传并跳转
        await uploadAndLeave(recorder, ctrl);
    }

    window.addEventListener('DOMContentLoaded', bootstrap);
})();
