let songBuffer;


const audioCtx = new AudioContext();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

const btn = document.createElement('button')
btn.innerText = 'loading...'
btn.style.pointerEvents = 'none'

btn.addEventListener('click', e => {
    const source = audioCtx.createBufferSource();
    source.connect(analyser);
    source.connect(audioCtx.destination);
    source.buffer = songBuffer;
    source.start();
})
document.body.append(btn)

window.fetch('/sobernow.mp3')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
    .then(audioBuffer => {
        songBuffer = audioBuffer;
        btn.style.pointerEvents = ''
        btn.innerText = 'play'
    }).catch(e => {
        console.error(e)
        btn.innerText = e
    })


const canvas = document.createElement('canvas')
const size = 1024

canvas.width = size
canvas.height = size

document.body.append(canvas)

const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D

ctx.fillStyle = 'rgba(0,0,0,255)'
ctx.fillRect(0, 0, size, size)

const lineData = new Uint8ClampedArray(size * 4)

const speed = 5

let time = 0

function getSpectrogramColor(value) {
    let vvalue = Math.pow(value, 2.2)
    // Ensure the input value is within the valid range [0, 1]
    vvalue = Math.min(1, Math.max(0, vvalue));
    value = Math.min(1, Math.max(0, value));

    // Map the value to the HSL color space
    const hue = (100 + -(1 - vvalue) * 240) % 360; // Map 0 to blue (240) and 1 to red (0)
    const saturation = value * 100; // Full saturation
    const lightness = vvalue * 100; // Map 0 to black (0) and 1 to white (100)

    // Convert HSL to RGB
    const { r, g, b } = hslToRgb(hue, saturation, lightness);

    return [Math.round(r), Math.round(g), Math.round(b)];
}

// Helper function to convert HSL to RGB
function hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
}

let nextImageData

function draw(tt) {
    time = tt / 1000

    if (nextImageData) {
        ctx.putImageData(nextImageData, -speed, 0)
    }


    // analyser.getByteTimeDomainData(dataArray);
    analyser.getByteFrequencyData(dataArray);

    // ctx.fillStyle = "rgb(255,0,255)";
    // ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < lineData.length / 4; i++) {
        const t = i / (lineData.length / 4)
        const idx = Math.floor((1 - t) * dataArray.length)
        const sample = dataArray[idx]

        const normalizedSample = sample / 255

        const [r, g, b] = getSpectrogramColor(normalizedSample)

        // r
        lineData[0 + i * 4] = r
        // g
        lineData[1 + i * 4] = g
        // b
        lineData[2 + i * 4] = b
        // a
        lineData[3 + i * 4] = 255
    }
    const imgData: ImageData = new ImageData(lineData, 1, size)

    for (let i = 0; i < speed; i++) {
        ctx.putImageData(imgData, size - i - 1, 0, 0, 0, 1, size)
    }


    nextImageData = ctx.getImageData(0, 0, size, size)

    // ctx.putImageData(imgData, 0, 0, 0, 0, 1, size,)

    // ctx.fillStyle = `rgb(0,${b},255)`;
    // ctx.fillRect(l, 0, 1, size);


    analyser.getByteTimeDomainData(dataArray);

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgb(255, 50, 255)";
    ctx.beginPath();

    const sliceWidth = size / bufferLength;
    let x = 0;

    let startX, startY
    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 255;

        let h = .4
        let y = v * size * h + (size / 2 * (1 - h))

        const a = (x / size) * Math.PI * 2

        const polarX = size / 2 + Math.sin(a) * size / 2 * v
        const polarY = size / 2 + Math.cos(a) * size / 2 * v
        if (x == 0) {
            startX = polarX
            startY = polarY
        }


        if (i === 0) {
            ctx.moveTo(polarX, polarY);
        } else {
            ctx.lineTo(polarX, polarY);
        }

        // if (i === 0) {
        //     ctx.moveTo(x, y);
        // } else {
        //     ctx.lineTo(x, y);
        // }

        x += sliceWidth;
    }
    // note: only use this for cartesian coordinates
    // ctx.lineTo(size, size / 2);
    // ctx.lineTo(startX, startY);
    ctx.stroke();

    requestAnimationFrame(draw)
}
draw(0)
