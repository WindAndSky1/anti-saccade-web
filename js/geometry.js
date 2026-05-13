/**
 * 视角 → 像素 换算。
 * 公式：pxOffset = viewingDistanceCm * tan(eccentricityDeg) * screenWidthPx / physicalWidthCm
 *
 * 实际像素偏移取自 window.screen.width（物理屏幕像素），换算到当前文档中相同物理距离对应的 CSS 像素。
 * 在 devicePixelRatio = 1 且窗口最大化时，该值与文档内偏移一致；为简化，全屏运行时直接用 screen.width。
 */
(function () {
    'use strict';

    function computeEccentricityPx(cfg) {
        const widthPx = window.screen.width || window.innerWidth;
        const tan = Math.tan(cfg.eccentricityDeg * Math.PI / 180);
        const cm = cfg.viewingDistanceCm * tan;
        return Math.round(cm * widthPx / cfg.physicalWidthCm);
    }

    function apply(cfg) {
        const px = computeEccentricityPx(cfg);
        document.documentElement.style.setProperty('--ecc-px', px + 'px');
        return px;
    }

    window.Geometry = { compute: computeEccentricityPx, apply };
})();
