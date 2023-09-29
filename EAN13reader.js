if (window.BarcodeDetector === undefined) {
    await import("https://unpkg.com/@zxing/library@latest")
}

export class Ean13Scaner {
    static cam_config = {
        video: {
            facingMode: { exact: 'environment' },
            aspectRatio: 1,
        },
        audio: false
    };
    #box;
    #interval;
    #video;
    #parent;
    #canvas;
    #canvasContext;
    #canvasOffs = {};
    #intervalID;
    #decode;
    #callback;
    #lastResult;

    constructor(parent) {
        this.#parent = parent;
        if (!getComputedStyle(this.#parent).position)
            this.#parent.style.position = 'relative';

        if ('BarcodeDetector' in window) {
            const barcodeDetector = new BarcodeDetector({ formats: ['ean_13'] });
            this.#decode = async function (canvas) {
                let barcodes = await barcodeDetector.detect(canvas);
                if (barcodes.length == 0)
                    return;
                let text = barcodes[0].rawValue;
                if (this.#lastResult == text)
                    this.#callback(text);
                this.#lastResult = text;
            }
        } else {
            const reader = new ZXing.EAN13Reader();
            let hints = new Map();
            hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13]);
            this.#decode = async function (canvas) {
                const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
                const hybridBinarizer = new ZXing.HybridBinarizer(luminanceSource);
                try {
                    var result = reader.decode(new ZXing.BinaryBitmap(hybridBinarizer), hints);
                } catch {
                    return;
                }
                let text = result.text;
                if (this.#lastResult == text)
                    this.#callback(text);
                this.#lastResult = text;
            }
        }
    }

    #createCanvas() {
        let res2sizeRatio = this.#video.videoWidth / this.#video.clientWidth;
        let cW = this.#canvasOffs.width = this.#box.width * res2sizeRatio;
        let cH = this.#canvasOffs.height = this.#box.height * res2sizeRatio;
        let cX = this.#canvasOffs.xOff = (this.#video.videoWidth - cW) / 2;
        let cY = this.#canvasOffs.yOff = (this.#video.videoHeight - cH) / 2;

        this.#canvas = document.createElement("canvas");
        this.#canvas.width = cW;
        this.#canvas.height = cH;

        this.#canvasContext = this.#canvas.getContext('2d', { willReadFrequently: true });
    }

    #drawFrameOnCanvas() {
        this.#canvasContext.drawImage(
            this.#video,
            /* sx */ this.#canvasOffs.xOff,
            /* sy */ this.#canvasOffs.yOff,
            /* sW */ this.#canvasOffs.width,
            /* sH */ this.#canvasOffs.height,
            /* dx */ 0,
            /* dy */ 0,
            /* dW */ this.#canvasOffs.width,
            /* dH */ this.#canvasOffs.height
        );
    }

    #clearParent() {
        this.#parent.textContent = '';
    }

    async #createVideo(stream) {
        const video = this.#video = document.createElement("video");
        video.setAttribute('autoplay', '');
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.style.cssText = "width: 100%;display: block";
        video.srcObject = stream;
        this.#parent.append(video);
        await video.play();
    }

    #createFrame() {
        let frame = document.createElement("div");
        frame.style.cssText = `
            position: absolute;
            inset: 0;
            margin: auto;
            border: dotted 4px white;
            box-sizing: content-box;
        `;
        frame.style.width = this.#box.width + "px";
        frame.style.height = this.#box.height + "px";
        this.#parent.append(frame);

        let line = document.createElement("div");
        line.style.cssText = `
            margin: 50% auto auto;
            height: 1.5px;
            background-color: red;
            border-radius: 1px;
        `;
        line.style.width = this.#box.width - 50 + "px";
        line.style.marginTop = frame.clientHeight / 2 + "px";
        frame.append(line);
    }

    async start(scan_box, callback, interval = 100) {
        this.#box = scan_box;
        this.#interval = interval;
        this.#callback = callback;
        this.#clearParent();
        try { // trying to get permission
            var stream = await navigator.mediaDevices.getUserMedia(Ean13Scaner.cam_config);
        } catch {
            return false;
        }
        await this.#createVideo(stream);
        this.#createFrame();
        this.#createCanvas();
        this.#runDecoder();
        return true;
    }

    get isScanning() {
        return Boolean(this.#intervalID);
    }

    #runDecoder() {
        this.#intervalID = setInterval(() => {
            this.#drawFrameOnCanvas();
            this.#decode(this.#canvas);
        }, this.#interval);
    }

    #stopDecoder() {
        clearInterval(this.#intervalID);
        this.#intervalID = undefined;
    }

    stop() {
        this.#video.srcObject.getTracks()[0].stop();
        this.#clearParent();
        if (this.isScanning)
            this.#stopDecoder();
        this.#canvas.remove();
    }

    pause() {
        this.#stopDecoder();
        this.#video.pause();
    }

    resume() {
        this.#video.play();
        this.#runDecoder();
    }
}