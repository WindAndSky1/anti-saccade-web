/**
 * 单试次完整时序（开发文档 §6 步骤 1~9）。
 *
 *   1. 400ms 空白
 *   2. fixation "+" 随机时长 ∈ {200,600,1000,1400,1800,2200}
 *   3. cue "=" 100ms（左或右）
 *   4. 50ms 空白
 *   5. cue "=" 100ms（同侧，"闪烁"效应）
 *   6. target Q/O，呈现 currentSOA 毫秒
 *        - AS：target 在 cue 对侧
 *        - PS：target 在 cue 同侧
 *   7. H 掩蔽 50ms（同 target 位置）
 *   8. 8 出现直到按键或 3000ms 超时（同 target 位置）
 *   9. 反馈（练习阶段 500ms 文字；正式阶段直接返回）
 */
(function () {
    'use strict';

    const FIX_TIMES = [200, 600, 1000, 1400, 1800, 2200];
    const PRE_TRIAL_BLANK_MS = 400;
    const CUE_ON_MS = 100;
    const CUE_GAP_MS = 50;
    const MASK_H_MS = 50;
    const FEEDBACK_MS = 500;

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function pickFixation() {
        return FIX_TIMES[Math.floor(Math.random() * FIX_TIMES.length)];
    }

    function $(id) { return document.getElementById(id); }

    function show(id, text) {
        const el = $(id);
        el.textContent = text;
        el.classList.add('show');
    }

    function hide(id) {
        const el = $(id);
        el.textContent = '';
        el.classList.remove('show');
    }

    function hideAllStim() {
        hide('center'); hide('left'); hide('right');
    }

    /**
     * 等待按键 9 / 0，或者超时（cfg.responseTimeoutMs）。
     * 返回 { key: '9'|'0'|'NONE', rtMs: number|null }
     * RT 起点为传入的 startMark（performance.now()）
     */
    function awaitResponse(startMark, timeoutMs) {
        return new Promise(resolve => {
            let done = false;
            const finish = (key, rt) => {
                if (done) return;
                done = true;
                document.removeEventListener('keydown', onKey);
                clearTimeout(timer);
                resolve({ key, rtMs: rt });
            };
            const onKey = (e) => {
                if (e.key === '9' || e.key === '0') {
                    const rt = Math.round(performance.now() - startMark);
                    finish(e.key, rt);
                }
            };
            document.addEventListener('keydown', onKey);
            const timer = setTimeout(() => finish('NONE', null), timeoutMs);
        });
    }

    /**
     * 执行单个试次。
     * @param {object} opts
     *   - phase: 'practice' | 'formal'
     *   - trialNumber: number (在所属 phase 内的序号，从 1)
     *   - trialType: 'AS' | 'PS'
     *   - currentSoaMs: number
     *   - responseTimeoutMs: number
     *   - showFeedback: boolean (练习 true，正式 false)
     * @returns {object} 部分填充的 TrialRecord（不含 Rule A/B/C 与 next_SOA / reversal — 这些由调用方在调用 adaptive 后补齐）
     */
    async function runTrial(opts) {
        hideAllStim();

        // 1. 400 ms 黑屏
        await sleep(PRE_TRIAL_BLANK_MS);

        // 2. fixation
        const fixMs = pickFixation();
        show('center', '+');
        await sleep(fixMs);
        hide('center');

        // 3-5. cue 闪烁
        const cueSide = Math.random() < 0.5 ? 'left' : 'right';
        show(cueSide, '=');
        await sleep(CUE_ON_MS);
        hide(cueSide);
        await sleep(CUE_GAP_MS);
        show(cueSide, '=');
        await sleep(CUE_ON_MS);
        hide(cueSide);

        // 6. target
        const targetSide = (opts.trialType === 'AS')
            ? (cueSide === 'left' ? 'right' : 'left')
            : cueSide;
        const letter = Math.random() < 0.5 ? 'Q' : 'O';
        const correctKey = (letter === 'Q') ? '9' : '0';

        show(targetSide, letter);
        await sleep(opts.currentSoaMs);

        // 7. H 掩蔽
        show(targetSide, 'H');
        await sleep(MASK_H_MS);

        // 8. 8 + 等待按键
        show(targetSide, '8');
        const startMark = performance.now();
        const { key, rtMs } = await awaitResponse(startMark, opts.responseTimeoutMs);
        hide(targetSide);

        const pressed = (key !== 'NONE');
        const isCorrect = pressed && (key === correctKey);
        const rtValid = pressed && rtMs != null && rtMs >= 100;

        // 9. 反馈
        if (opts.showFeedback) {
            const fb = $('feedback');
            fb.textContent = isCorrect ? '正确' : '错误';
            fb.classList.remove('good', 'bad');
            fb.classList.add(isCorrect ? 'good' : 'bad', 'show');
            await sleep(FEEDBACK_MS);
            fb.classList.remove('show');
            fb.textContent = '';
        }

        return {
            trial_number: opts.trialNumber,
            phase: opts.phase,
            trial_type: opts.trialType,
            cue_position: cueSide,
            target_position: targetSide,
            target_letter: letter,
            fixation_duration_ms: fixMs,
            current_SOA_ms: opts.currentSoaMs,
            key_pressed: pressed ? key : 'none',
            is_correct: isCorrect,
            RT_ms: pressed ? rtMs : null,
            RT_valid: rtValid
        };
    }

    window.Trial = { runTrial };
})();
