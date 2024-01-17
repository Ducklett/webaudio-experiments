let songBuffer: AudioBuffer;


let audioCtx: AudioContext
let analyser: AnalyserNode
let bufferLength: number
let dataArray: Uint8Array
let micStream: MediaStream

let audioInitialized = false
let micInitialized = false

async function initAudioContect() {
    if (audioInitialized) return
    audioInitialized = true

    audioCtx = new AudioContext()
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    if (!micInitialized && getInputKind() == 'source-mic') {
        micInitialized = true

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // Access the user's microphone
            await navigator.mediaDevices.getUserMedia({ audio: true })
                .then(function (stream) {
                    micStream = stream

                })
                .catch(function (error) {
                    // Handle any errors that occur during microphone access
                    console.error('Error accessing microphone:', error);
                });
        } else {
            console.error('Web Audio API is not supported in this browser.');
        }

    }


}

const btn = document.querySelector('#play-btn') as HTMLButtonElement

let playing = false

btn.addEventListener('click', async e => {

    btn.innerText = 'loading...'
    btn.style.pointerEvents = 'none'
    await initAudioContect()

    if (!songBuffer) {
        await window.fetch('/sobernow.mp3')
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
    }

    if (playing) {
        playing = false
        audioCtx?.suspend()
        btn.innerText = 'play'
    } else if (audioCtx.state == 'suspended') {
        playing = true
        audioCtx?.resume()
        btn.innerText = 'pause'
    } else {
        if (getInputKind() == 'source-mic') {
            playMic()
        } else {
            playBuffer(songBuffer)
        }
    }
})

let curSource: AudioBufferSourceNode | MediaStreamAudioSourceNode

function playMic() {
    console.log('Microphone connected and streaming.');

    btn.innerText = 'pause'

    if (curSource && curSource instanceof AudioBufferSourceNode) {
        curSource.onended = null
        curSource.stop()
    }

    playing = true

    curSource = audioCtx.createMediaStreamSource(micStream);
    curSource.connect(audioCtx.destination);

    curSource.connect(analyser);
    curSource.connect(audioCtx.destination);
    // curSource.start();
    // curSource.onended = () => {
    //     btn.innerText = 'play'
    //     playing = false
    // }
}

function playBuffer(buf: AudioBuffer) {
    btn.innerText = 'pause'

    if (curSource) {
        curSource.onended = null
        curSource.stop()
    }

    playing = true

    curSource = audioCtx.createBufferSource();
    curSource.connect(analyser);
    curSource.connect(audioCtx.destination);
    curSource.buffer = buf;
    curSource.start();
    curSource.onended = () => {
        btn.innerText = 'play'
        playing = false
    }
}


const canvas = document.querySelector('canvas') as HTMLCanvasElement

function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];

    initAudioContect()

    if (file) {
        const reader = new FileReader();

        reader.onload = function (event) {

            audioCtx.decodeAudioData(event.target?.result as any)
                .then(audioBuffer => {
                    songBuffer = audioBuffer;
                    canvas.classList.remove('drag-over');

                    playBuffer(songBuffer)
                })
                .catch(error => {
                    console.error(error);
                    btn.innerText = error;
                });
        };

        reader.readAsArrayBuffer(file);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    canvas.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    canvas.classList.remove('drag-over');
}


canvas.addEventListener('dragover', handleDragOver);
canvas.addEventListener('dragleave', handleDragLeave);
canvas.addEventListener('drop', handleDrop);



const waveformKind = document.getElementById('waveform-kind') as HTMLSelectElement

function getInputKind() {
    const val = (document.querySelector("#audio-source input[type=radio]:checked") as HTMLInputElement)?.id ?? 'source-file'
    return val
}




const size = 512

canvas.width = size
canvas.height = size


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

    if (!playing) {
        requestAnimationFrame(draw)
        return
    }

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

    if (waveformKind.value == 'circular') {
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
    } else if (waveformKind.value == 'horizontal') {
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 255;

            let h = .4
            let y = v * size * h + (size / 2 * (1 - h))

            const a = (x / size) * Math.PI * 2

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }
        ctx.lineTo(size, size / 2);
        ctx.stroke();
    }

    requestAnimationFrame(draw)
}
draw(0)
