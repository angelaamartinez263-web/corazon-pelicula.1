const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;
let dpr = Math.min(window.devicePixelRatio || 1, 2);

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;

    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resize();
window.addEventListener("resize", resize);

// ============================================================
// COLORES Y CONFIGURACIÓN
// ============================================================

const BLUE = [
    "#ffffff",
    "#dff7ff",
    "#bfeeff",
    "#8bdcff",
    "#4dcfff",
    "#19bfff",
    "#008cff",
    "#1769ff",
    "#3155ff"
];

const PARTICLE_COUNT = 1800;

// Ciclo:
// Corazón → desarme → vacío → reconstrucción → corazón
const CYCLE = 420;

const HOLD_START = 70;
const BREAK_START = 85;
const BREAK_END = 185;
const EMPTY_END = 235;
const FORM_END = 350;

let frame = 0;
let rotationY = 0;
let targetRotationY = 0;

let dragging = false;
let previousX = 0;

const particles = [];
const sparks = [];

// ============================================================
// UTILIDADES
// ============================================================

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function easeInOut(t) {
    t = clamp(t, 0, 1);

    return t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOut(t) {
    t = clamp(t, 0, 1);

    return 1 - Math.pow(1 - t, 3);
}

// ============================================================
// CORAZÓN 3D
// ============================================================

function heartPoint(t, depth) {

    const scale = Math.min(width, height) / 43;

    const x =
        16 * Math.pow(Math.sin(t), 3);

    const y =
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t);

    // Relleno uniforme dentro del corazón.
    const fill = Math.sqrt(Math.random());

    let px = x * scale * fill;
    let py = -y * scale * fill;

    // Volumen del corazón.
    const thickness =
        Math.pow(
            Math.max(0.12, Math.abs(Math.sin(t))),
            0.65
        );

    const pz =
        depth *
        scale *
        5.4 *
        thickness;

    return {
        x: px,
        y: py,
        z: pz
    };
}

function project(x, y, z) {

    // Rotación en Y.
    let rx =
        x * Math.cos(rotationY) +
        z * Math.sin(rotationY);

    let rz =
        -x * Math.sin(rotationY) +
        z * Math.cos(rotationY);

    const camera = 700;

    const perspective =
        camera / (camera + rz);

    return {
        x: width / 2 + rx * perspective,
        y: height / 2 - 55 + y * perspective,
        scale: perspective,
        z: rz
    };
}

// ============================================================
// PARTÍCULA DEL CORAZÓN
// ============================================================

class Particle {

    constructor() {

        this.t =
            Math.random() * Math.PI * 2;

        this.depth =
            random(-1, 1);

        const point =
            heartPoint(
                this.t,
                this.depth
            );

        this.homeX = point.x;
        this.homeY = point.y;
        this.homeZ = point.z;

        // Posición inicial para reconstrucción.
        this.startX =
            random(-125, 125);

        this.startY =
            random(185, 245);

        this.startZ =
            random(-80, 80);

        // Dirección de dispersión.
        const angle =
            random(0, Math.PI * 2);

        const force =
            random(80, 270);

        this.breakX =
            Math.cos(angle) * force;

        this.breakY =
            Math.sin(angle) * force -
            random(50, 190);

        this.breakZ =
            random(-150, 150);

        // Algunas partículas salen mucho más arriba.
        if (Math.random() < 0.42) {

            this.breakY -=
                random(80, 240);
        }

        this.size =
            random(0.55, 2.25);

        this.color =
            BLUE[
                Math.floor(
                    Math.random() * BLUE.length
                )
            ];

        this.alpha =
            random(0.55, 1);

        this.twinkle =
            random(0, Math.PI * 2);

        this.twinkleSpeed =
            random(0.025, 0.08);

        this.x = width / 2;
        this.y = height / 2;

        this.z = 0;

        this.screenScale = 1;
        this.currentAlpha = 1;
    }

    update(phase, phaseProgress) {

        let localX = this.homeX;
        let localY = this.homeY;
        let localZ = this.homeZ;

        // ========================================================
        // CORAZÓN COMPLETO
        // ========================================================

        if (phase === "hold") {

            localX = this.homeX;
            localY = this.homeY;
            localZ = this.homeZ;
        }

        // ========================================================
        // DESARME
        // ========================================================

        if (phase === "break") {

            const p =
                easeInOut(phaseProgress);

            localX =
                this.homeX +
                this.breakX * p;

            localY =
                this.homeY +
                this.breakY * p +
                90 * p * p;

            localZ =
                this.homeZ +
                this.breakZ * p;
        }

        // ========================================================
        // CORAZÓN TOTALMENTE DESARMADO
        // ========================================================

        if (phase === "empty") {

            const drift =
                Math.sin(
                    frame * 0.025 +
                    this.twinkle
                ) * 8;

            localX =
                this.homeX +
                this.breakX +
                drift;

            localY =
                this.homeY +
                this.breakY +
                90 +
                Math.sin(
                    frame * 0.018 +
                    this.twinkle
                ) * 10;

            localZ =
                this.homeZ +
                this.breakZ;
        }

        // ========================================================
        // RECONSTRUCCIÓN
        // ========================================================

        if (phase === "form") {

            const p =
                easeInOut(phaseProgress);

            const fromX =
                this.startX;

            const fromY =
                this.startY;

            const fromZ =
                this.startZ;

            localX =
                fromX +
                (this.homeX - fromX) * p;

            localY =
                fromY +
                (this.homeY - fromY) * p;

            localZ =
                fromZ +
                (this.homeZ - fromZ) * p;

            // Pequeño impulso.
            const wave =
                Math.sin(p * Math.PI) *
                (1 - p) *
                35;

            localY += wave;
        }

        // ========================================================
        // PROYECCIÓN
        // ========================================================

        const projected =
            project(
                localX,
                localY,
                localZ
            );

        this.x = projected.x;
        this.y = projected.y;

        this.screenScale =
            projected.scale;

        // Brillo.
        this.twinkle +=
            this.twinkleSpeed;

        const sparkle =
            0.72 +
            Math.sin(this.twinkle) * 0.28;

        this.currentAlpha =
            this.alpha * sparkle;

        if (phase === "empty") {

            this.currentAlpha *= 0.72;
        }

        if (phase === "form") {

            this.currentAlpha *=
                0.45 +
                phaseProgress * 0.55;
        }
    }

    draw() {

        const radius =
            Math.max(
                0.35,
                this.size *
                this.screenScale
            );

        ctx.globalAlpha =
            clamp(
                this.currentAlpha,
                0,
                1
            );

        ctx.fillStyle =
            this.color;

        ctx.shadowBlur =
            radius > 1.2
                ? 9
                : 4;

        ctx.shadowColor =
            this.color;

        ctx.beginPath();

        ctx.arc(
            this.x,
            this.y,
            radius,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}

// ============================================================
// CHISPAS
// ============================================================

class Spark {

    constructor(x, y) {

        this.x = x;
        this.y = y;

        const angle =
            random(
                0,
                Math.PI * 2
            );

        const speed =
            random(1.5, 8);

        this.vx =
            Math.cos(angle) * speed;

        this.vy =
            Math.sin(angle) * speed -
            random(1, 5);

        this.life = 0;

        this.maxLife =
            random(22, 65);

        this.size =
            random(0.5, 2.4);

        this.color =
            BLUE[
                Math.floor(
                    Math.random() *
                    BLUE.length
                )
            ];
    }

    update() {

        this.life++;

        this.x += this.vx;
        this.y += this.vy;

        this.vx *= 0.965;
        this.vy *= 0.965;

        this.vy += 0.025;
    }

    draw() {

        const p =
            this.life /
            this.maxLife;

        const alpha =
            (1 - p) * 0.9;

        if (alpha <= 0) return;

        ctx.globalAlpha =
            alpha;

        ctx.fillStyle =
            this.color;

        ctx.shadowBlur = 8;
        ctx.shadowColor =
            this.color;

        ctx.beginPath();

        ctx.arc(
            this.x,
            this.y,
            this.size *
                (1 - p * 0.5),
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}

// ============================================================
// CREAR PARTÍCULAS
// ============================================================

for (
    let i = 0;
    i < PARTICLE_COUNT;
    i++
) {

    particles.push(
        new Particle()
    );
}

// ============================================================
// FASE DEL CICLO
// ============================================================

function getPhase() {

    const t =
        frame % CYCLE;

    if (t < HOLD_START) {

        return {
            name: "hold",
            progress: 0
        };
    }

    if (t < BREAK_END) {

        return {
            name: "break",

            progress:
                (t - BREAK_START) /
                (BREAK_END - BREAK_START)
        };
    }

    if (t < EMPTY_END) {

        return {
            name: "empty",

            progress:
                (t - BREAK_END) /
                (EMPTY_END - BREAK_END)
        };
    }

    return {

        name: "form",

        progress:
            (t - EMPTY_END) /
            (FORM_END - EMPTY_END)
    };
}

// ============================================================
// PLATAFORMA DE LUZ
// ============================================================

function drawPlatform() {

    const cx =
        width / 2;

    const cy =
        height / 2 + 190;

    const pulse =
        Math.sin(
            frame * 0.055
        ) * 5;

    const rx =
        105 + pulse;

    const ry =
        20 +
        pulse * 0.25;

    ctx.save();

    // Halo.
    const gradient =
        ctx.createRadialGradient(
            cx,
            cy,
            0,
            cx,
            cy,
            150
        );

    gradient.addColorStop(
        0,
        "rgba(0,220,255,0.34)"
    );

    gradient.addColorStop(
        0.35,
        "rgba(0,150,255,0.16)"
    );

    gradient.addColorStop(
        1,
        "rgba(0,0,0,0)"
    );

    ctx.fillStyle =
        gradient;

    ctx.beginPath();

    ctx.ellipse(
        cx,
        cy,
        160,
        70,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    // Disco central.
    ctx.beginPath();

    ctx.ellipse(
        cx,
        cy,
        rx,
        ry,
        0,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        "rgba(0,185,255,0.22)";

    ctx.shadowBlur = 40;
    ctx.shadowColor =
        "#00eaff";

    ctx.fill();

    // Centro.
    ctx.beginPath();

    ctx.ellipse(
        cx,
        cy - 1,
        rx * 0.65,
        ry * 0.48,
        0,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        "rgba(70,235,255,0.32)";

    ctx.shadowBlur = 25;
    ctx.shadowColor =
        "#00f5ff";

    ctx.fill();

    // Ondas.
    for (
        let i = 0;
        i < 4;
        i++
    ) {

        const p =
            (
                frame * 0.012 +
                i * 0.25
            ) % 1;

        const waveX =
            rx *
            (0.75 + p * 1.55);

        const waveY =
            ry *
            (0.75 + p * 1.55);

        const alpha =
            (1 - p) * 0.55;

        ctx.beginPath();

        ctx.ellipse(
            cx,
            cy,
            waveX,
            waveY,
            0,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle =
            `rgba(0,220,255,${alpha})`;

        ctx.lineWidth = 1.5;

        ctx.shadowBlur = 10;
        ctx.shadowColor =
            "#00eaff";

        ctx.stroke();
    }

    ctx.restore();
}

// ============================================================
// POLVO DE LA PLATAFORMA
// ============================================================

function drawPlatformDust() {

    const cx =
        width / 2;

    const cy =
        height / 2 + 188;

    for (
        let i = 0;
        i < 120;
        i++
    ) {

        const angle =
            (i / 120) *
            Math.PI *
            2;

        const radius =
            35 +
            ((i * 17) % 110);

        const x =
            cx +
            Math.cos(angle) *
            radius;

        const y =
            cy +
            Math.sin(angle) * 8 +
            random(-2, 2);

        const alpha =
            0.12 +
            0.2 *
            Math.sin(
                frame * 0.04 + i
            ) ** 2;

        ctx.globalAlpha =
            alpha;

        ctx.fillStyle =
            BLUE[
                i % BLUE.length
            ];

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            random(0.4, 1.2),
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.globalAlpha = 1;
}

// ============================================================
// GENERAR CHISPAS
// ============================================================

function spawnSparks(amount) {

    const cx =
        width / 2;

    const cy =
        height / 2 - 40;

    for (
        let i = 0;
        i < amount;
        i++
    ) {

        sparks.push(
            new Spark(
                cx + random(-80, 80),
                cy + random(-80, 100)
            )
        );
    }
}

// ============================================================
// ANIMACIÓN
// ============================================================

function animate() {

    frame++;

    // Fondo.
    ctx.fillStyle =
        "rgba(0,0,0,0.28)";

    ctx.fillRect(
        0,
        0,
        width,
        height
    );

    const phase =
        getPhase();

    // Chispas durante el desarme.
    if (
        phase.name === "break" &&
        Math.random() < 0.65
    ) {

        spawnSparks(3);
    }

    // Chispas durante la reconstrucción.
    if (
        phase.name === "form" &&
        Math.random() < 0.3
    ) {

        spawnSparks(1);
    }

    drawPlatform();
    drawPlatformDust();

    // Actualizar partículas.
    for (
        const particle of particles
    ) {

        particle.update(
            phase.name,
            phase.progress
        );
    }

    // Profundidad.
    particles.sort(
        (a, b) =>
            a.screenScale -
            b.screenScale
    );

    // Dibujar partículas.
    for (
        const particle of particles
    ) {

        particle.draw();
    }

    // Chispas.
    for (
        let i = sparks.length - 1;
        i >= 0;
        i--
    ) {

        const spark =
            sparks[i];

        spark.update();
        spark.draw();

        if (
            spark.life >=
            spark.maxLife
        ) {

            sparks.splice(i, 1);
        }
    }

    ctx.globalAlpha = 1;

    // Rotación automática.
    rotationY +=
        (
            targetRotationY -
            rotationY
        ) * 0.04;

    if (!dragging) {

        targetRotationY +=
            0.001;
    }

    requestAnimationFrame(
        animate
    );
}

// ============================================================
// MOUSE
// ============================================================

window.addEventListener(
    "mousedown",
    (e) => {

        dragging = true;
        previousX =
            e.clientX;
    }
);

window.addEventListener(
    "mousemove",
    (e) => {

        if (!dragging) return;

        const dx =
            e.clientX -
            previousX;

        targetRotationY +=
            dx * 0.008;

        previousX =
            e.clientX;
    }
);

window.addEventListener(
    "mouseup",
    () => {

        dragging = false;
    }
);

window.addEventListener(
    "mouseleave",
    () => {

        dragging = false;
    }
);

// ============================================================
// TÁCTIL
// ============================================================

window.addEventListener(
    "touchstart",
    (e) => {

        if (!e.touches.length)
            return;

        dragging = true;

        previousX =
            e.touches[0].clientX;
    },
    { passive: true }
);

window.addEventListener(
    "touchmove",
    (e) => {

        if (
            !dragging ||
            !e.touches.length
        ) {
            return;
        }

        const dx =
            e.touches[0].clientX -
            previousX;

        targetRotationY +=
            dx * 0.008;

        previousX =
            e.touches[0].clientX;
    },
    { passive: true }
);

window.addEventListener(
    "touchend",
    () => {

        dragging = false;
    }
);

// ============================================================
// INICIO
// ============================================================

frame = 0;

animate();