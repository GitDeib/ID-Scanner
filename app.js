// =========================================================
// CONFIG
// =========================================================
const GOOGLE_SCRIPT_URL =
    "https://script.google.com/a/macros/umindanao.edu.ph/s/AKfycbzBX6kB3ewjsjKrmPqcFcyH7Hh_Kd0yowxicqOA47eq-6yAnOQIOUnt6NceVv5ozswIFg/exec";

// =========================================================
// DOM
// =========================================================
const camera = document.getElementById("camera");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const cameraLoading = document.getElementById("cameraLoading");
const captureCanvas = document.getElementById("captureCanvas");
const captureButton = document.getElementById("captureButton");
const captureButtonText = document.getElementById("captureButtonText");
const retakeButton = document.getElementById("retakeButton");
const clearButton = document.getElementById("clearButton");
const confirmButton = document.getElementById("confirmButton");

const scanStatus = document.getElementById("scanStatus");
const cameraInstruction = document.getElementById("cameraInstruction");
const ocrStatus = document.getElementById("ocrStatus");
const scannedIdPreview = document.getElementById("scannedIdPreview");
const scannedIdCapturedBadge = document.getElementById("scannedIdCapturedBadge");
const completeStatusCircle = document.getElementById("completeStatusCircle");
const completeStatusText = document.getElementById("completeStatusText");

const captureScreen = document.getElementById("captureScreen");
const processingScreen = document.getElementById("processingScreen");
const reviewScreen = document.getElementById("reviewScreen");
const processingText = document.getElementById("processingText");

const signatureCanvas = document.getElementById("signatureCanvas");
const clearSignatureButton = document.getElementById("clearSignatureButton");
const expandSignatureButton = document.getElementById("expandSignatureButton");
const signatureStatus = document.getElementById("signatureStatus");

const signatureFullscreenOverlay = document.getElementById("signatureFullscreenOverlay");
const fsSignatureCanvas = document.getElementById("fsSignatureCanvas");
const fsSignatureClearButton = document.getElementById("fsSignatureClearButton");
const fsSignatureDoneButton = document.getElementById("fsSignatureDoneButton");
const fsSignatureCloseButton = document.getElementById("fsSignatureCloseButton");

const lockScreen = document.getElementById("lockScreen");
const lockSubtitle = document.getElementById("lockSubtitle");
const pinDots = document.getElementById("pinDots");
const pinKeypad = document.getElementById("pinKeypad");
const pinError = document.getElementById("pinError");
const pinSubmitButton = document.getElementById("pinSubmitButton");
const lockButton = document.getElementById("lockButton");
const sessionBadge = document.getElementById("sessionBadge");
const sessionCountdown = document.getElementById("sessionCountdown");

const fields = {
    name: document.getElementById("name"),
    birthdate: document.getElementById("birthdate"),
    age: document.getElementById("age"),
    sex: document.getElementById("sex"),
    address: document.getElementById("address"),
    idNumber: document.getElementById("idNumber"),
};

// =========================================================
// STATE
// =========================================================
let cameraStream = null;
let scannedIdImage = null;

// --- Session state ---
// The token is held in memory only: never localStorage/sessionStorage,
// so closing the tab (or a passer-by opening it later) can't inherit
// an authenticated session.
let sessionToken = null;
let sessionExpiresAt = 0;
let sessionTimer = null;
let pinBuffer = "";
const PIN_MAX_LENGTH = 8;

// =========================================================
// AUTH / SESSION (client side)
// =========================================================
// Everything in this section is UX. It keeps an unattended kiosk from
// being walked up to and used, and it stops an expired session from
// silently losing a scan. It is NOT the security boundary — the Apps
// Script validates the token on every extract/save, so a user who
// deletes the lock screen in DevTools can still open the camera view
// but cannot make the server read an ID or write a row.

function isSessionValid() {
    return !!sessionToken && Date.now() < sessionExpiresAt;
}

// Single place every server call goes through, so the session token is
// always attached and an AUTH rejection always lands us back on the
// lock screen instead of surfacing as a confusing generic error.
async function postToServer(payload, { requiresAuth = true } = {}) {
    if (requiresAuth && !isSessionValid()) {
        lockApp("Your session has expired. Please enter your PIN again.");
        throw new Error("Session expired.");
    }

    const body = requiresAuth ? { ...payload, token: sessionToken } : payload;

    const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body),
    });

    const raw = await res.text();
    let result;
    try {
        result = JSON.parse(raw);
    } catch {
        console.error("Non-JSON response:", raw);
        throw new Error("Server did not return valid JSON. See console for the raw response.");
    }

    // The server extends the session on every authorised request, so
    // keep the local countdown in step with it.
    if (result.expiresAt) setSessionExpiry(result.expiresAt);

    if (result.code === "AUTH") {
        lockApp(result.message || "Please enter your PIN again.");
        throw new Error(result.message || "Session expired.");
    }

    return result;
}

function setSessionExpiry(expiresAt) {
    sessionExpiresAt = expiresAt;
    updateSessionCountdown();
}

function startSessionTimer() {
    clearInterval(sessionTimer);
    sessionTimer = setInterval(() => {
        if (!isSessionValid()) {
            return lockApp("Your session has expired. Please enter your PIN again.");
        }
        updateSessionCountdown();
    }, 1000);
}

function updateSessionCountdown() {
    if (!sessionCountdown) return;
    const msLeft = Math.max(0, sessionExpiresAt - Date.now());
    const minutes = Math.floor(msLeft / 60000);
    const seconds = Math.floor((msLeft % 60000) / 1000);
    sessionCountdown.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;

    // Warn visually in the last five minutes.
    const warning = msLeft < 5 * 60 * 1000;
    sessionBadge.className = warning
        ? "hidden items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 sm:flex"
        : "hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 sm:flex";
    sessionBadge.classList.remove("hidden");
    sessionBadge.querySelector("span").className = warning
        ? "h-2 w-2 rounded-full bg-amber-500"
        : "h-2 w-2 rounded-full bg-emerald-500";
}

async function attemptUnlock() {
    if (pinBuffer.length < 4) {
        return showPinError("Please enter at least 4 digits.");
    }

    pinSubmitButton.disabled = true;
    pinSubmitButton.textContent = "Checking...";

    try {
        const result = await postToServer(
            { action: "login", pin: pinBuffer },
            { requiresAuth: false }
        );

        if (!result.success) {
            // Wrong PIN or lockout — never say which digits were wrong.
            const suffix = typeof result.attemptsLeft === "number"
                ? ` ${result.attemptsLeft} attempt(s) left.`
                : "";
            setPinBuffer("");
            return showPinError((result.message || "Incorrect PIN.") + suffix);
        }

        sessionToken = result.token;
        setSessionExpiry(result.expiresAt);
        setPinBuffer("");
        unlockApp();

    } catch (error) {
        console.error("Login error:", error);
        showPinError("Could not reach the server. Check your connection.");
    } finally {
        pinSubmitButton.disabled = false;
        pinSubmitButton.textContent = "Unlock";
    }
}

function unlockApp() {
    hidePinError();
    lockScreen.classList.add("hidden");
    document.body.classList.remove("app-locked");
    startSessionTimer();
    updateSessionCountdown();

    captureButton.disabled = false;
    confirmButton.disabled = false;

    showScreen("capture");
    startCamera();
}

// Locking always tears down everything sensitive: the camera stops,
// the token is dropped, and any half-finished record (ID photo,
// extracted personal data, signature) is cleared so the next person
// at the device can't see or submit it.
function lockApp(message) {
    clearInterval(sessionTimer);
    sessionTimer = null;

    const hadToken = sessionToken;
    sessionToken = null;
    sessionExpiresAt = 0;

    stopCamera();
    closeSignatureFullscreen();
    clearForm();
    clearSignature();
    scannedIdImage = null;
    scannedIdPreview.innerHTML = `<span class="text-xs text-slate-400">No image</span>`;
    scannedIdCapturedBadge.classList.add("hidden");
    resetCompleteStep();
    scanStatus.textContent = "Ready to capture ID";
    setOCRStatus("Waiting", "waiting");
    showScreen("capture");

    captureButton.disabled = true;
    confirmButton.disabled = true;
    sessionBadge.classList.add("hidden");

    setPinBuffer("");
    lockScreen.classList.remove("hidden");
    document.body.classList.add("app-locked");

    if (message) {
        lockSubtitle.textContent = message;
    } else {
        lockSubtitle.textContent = "Authorised staff only.";
    }

    // Best-effort: tell the server to destroy the session too, so a
    // stolen token can't outlive the lock.
    if (hadToken) {
        fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "logout", token: hadToken }),
        }).catch(() => { /* nothing useful to do if this fails */ });
    }
}

// ---- PIN entry UI ----
function setPinBuffer(value) {
    pinBuffer = value;
    renderPinDots();
}

function renderPinDots() {
    // Show one dot per entered digit, with a minimum of four outlines
    // so the field doesn't look empty before typing.
    const count = Math.max(4, pinBuffer.length);
    pinDots.innerHTML = Array.from({ length: count }, (_, i) =>
        `<span class="pin-dot ${i < pinBuffer.length ? "filled" : ""}"></span>`
    ).join("");
}

function showPinError(message) {
    pinError.textContent = message;
    pinError.classList.remove("hidden");
}

function hidePinError() {
    pinError.classList.add("hidden");
}

function setupPinKeypad() {
    pinKeypad.addEventListener("click", event => {
        const button = event.target.closest("[data-key]");
        if (!button) return;

        const key = button.dataset.key;
        hidePinError();

        if (key === "clear") return setPinBuffer("");
        if (key === "back") return setPinBuffer(pinBuffer.slice(0, -1));
        if (pinBuffer.length >= PIN_MAX_LENGTH) return;
        setPinBuffer(pinBuffer + key);
    });

    pinSubmitButton.addEventListener("click", attemptUnlock);
    lockButton?.addEventListener("click", () => lockApp("Locked. Enter your PIN to continue."));

    // Physical keyboard support for desktop kiosks.
    document.addEventListener("keydown", event => {
        if (lockScreen.classList.contains("hidden")) return;
        if (/^\d$/.test(event.key)) {
            hidePinError();
            if (pinBuffer.length < PIN_MAX_LENGTH) setPinBuffer(pinBuffer + event.key);
        } else if (event.key === "Backspace") {
            hidePinError();
            setPinBuffer(pinBuffer.slice(0, -1));
        } else if (event.key === "Enter") {
            attemptUnlock();
        }
    });

    renderPinDots();
}

// =========================================================
// SCREENS
// =========================================================
function showScreen(name) {
    [captureScreen, processingScreen, reviewScreen].forEach(s => s.classList.remove("active"));
    ({ capture: captureScreen, processing: processingScreen, review: reviewScreen }[name])?.classList.add("active");
}

// =========================================================
// CAMERA
// =========================================================
async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
        return showCameraError("Camera access is not supported by this browser.");
    }

    cameraPlaceholder.classList.add("hidden");
    cameraLoading.classList.remove("hidden");
    cameraLoading.classList.add("flex");

    try {
        stopCamera();
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
            audio: false,
        });
        camera.srcObject = cameraStream;
        cameraLoading.classList.add("hidden");
        cameraLoading.classList.remove("flex");
        await camera.play();
    } catch (error) {
        console.error("Camera error:", error);
        cameraLoading.classList.add("hidden");
        cameraLoading.classList.remove("flex");
        showCameraError("Unable to access the camera. Please allow camera permission and try again.");
    }
}

function stopCamera() {
    cameraStream?.getTracks().forEach(t => t.stop());
    cameraStream = null;
    camera.srcObject = null;
}

function showCameraError(message) {
    cameraPlaceholder.classList.remove("hidden");
    cameraPlaceholder.classList.add("flex");
    cameraPlaceholder.innerHTML = `
    <div class="px-6 text-center">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008M10.29 3.86l-7.07 12.25A1.5 1.5 0 004.52 18.36h14.96a1.5 1.5 0 001.3-2.25L13.71 3.86a1.5 1.5 0 00-2.6 0z" />
        </svg>
      </div>
      <p class="text-sm font-medium text-white">Camera unavailable</p>
      <p class="mt-2 text-xs leading-relaxed text-slate-400">${message}</p>
      <button type="button" onclick="startCamera()" class="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">Try Again</button>
    </div>`;
}

// =========================================================
// IMAGE HELPERS
// =========================================================
function compressImage(canvas, maxWidth = 800, quality = 0.6) {
    const scale = Math.min(1, maxWidth / canvas.width);
    const width = Math.round(canvas.width * scale);
    const height = Math.round(canvas.height * scale);
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    out.getContext("2d").drawImage(canvas, 0, 0, width, height);
    return out.toDataURL("image/jpeg", quality);
}

function showScannedIdPreview(imageData) {
    scannedIdPreview.innerHTML = `<img src="${imageData}" alt="Scanned ID" class="h-full w-full object-cover">`;
}

// =========================================================
// CAPTURE -> QUICK EXTRACT + SAVE (single tap)
// =========================================================
async function captureImage() {
    // Belt and braces: the server rejects an unauthenticated extract
    // anyway, but there's no point taking the photo first.
    if (!isSessionValid()) return lockApp("Your session has expired. Please enter your PIN again.");
    if (!cameraStream) return alert("Camera is not active.");
    if (!camera.videoWidth || !camera.videoHeight) return alert("Camera is not ready yet.");

    captureCanvas.width = camera.videoWidth;
    captureCanvas.height = camera.videoHeight;
    captureCanvas.getContext("2d").drawImage(camera, 0, 0, captureCanvas.width, captureCanvas.height);

    scannedIdImage = compressImage(captureCanvas, 800, 0.6);
    showScannedIdPreview(scannedIdImage);
    scannedIdCapturedBadge.classList.remove("hidden");
    stopCamera();

    processingText.textContent = "Reading the ID...";
    showScreen("processing");
    setOCRStatus("Extracting...", "loading");

    try {
        // Extract only — nothing is saved to Sheets/Drive yet.
        const extracted = await extractIdData(scannedIdImage);
        applyExtractedData(extracted);
        setOCRStatus("Extracted", "success");
        scanStatus.textContent = "ID captured — review before saving";
    } catch (error) {
        console.error("Extraction error:", error);
        setOCRStatus("Extraction failed", "error");
        alert("Could not read the ID automatically. Please fill in the details manually, then tap Confirm & Save.");
        scanStatus.textContent = "ID captured — review the information";
    }

    updateCompleteStep();
    showScreen("review");

    // The signature box lives on this screen, which has been
    // display:none until now — size its drawing surface now that
    // it actually has a real width/height to measure.
    resizeSignatureCanvas();
}

// =========================================================
// STRUCTOCR EXTRACTION (extract only, no save)
// =========================================================
async function extractIdData(image) {
    const result = await postToServer({ action: "extract", scannedIdImage: image });
    if (!result.success) throw new Error(result.message || "Extraction failed.");
    return result.data;
}

function applyExtractedData(data) {
    if (!data) return;
    if (data.name) fields.name.value = data.name;
    if (data.birthdate) {
        const formatted = toMMDDYYYY(data.birthdate);
        fields.birthdate.value = formatted;
        const age = calculateAge(formatted);
        if (age !== null) fields.age.value = age;
    }
    if (data.sex) fields.sex.value = data.sex === "M" ? "Male" : data.sex === "F" ? "Female" : data.sex;
    if (data.address) fields.address.value = data.address;
    if (data.idNumber) fields.idNumber.value = data.idNumber;
}

function toMMDDYYYY(isoDate) {
    const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[2]}/${m[3]}/${m[1]}` : isoDate;
}

function calculateAge(mmddyyyy) {
    const [mm, dd, yyyy] = mmddyyyy.split("/").map(Number);
    if (!mm || !dd || !yyyy) return null;
    const birth = new Date(yyyy, mm - 1, dd);
    if (birth.getFullYear() !== yyyy || birth.getMonth() !== mm - 1 || birth.getDate() !== dd) return null;

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const hadBirthday = today.getMonth() > birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
    if (!hadBirthday) age--;
    return age >= 0 ? age : null;
}

// =========================================================
// STATUS / STEP UI
// =========================================================
function setOCRStatus(message, type) {
    ocrStatus.textContent = message;
    ocrStatus.className = "rounded-full px-2 py-1 text-[10px] font-semibold " + ({
        loading: "bg-blue-50 text-blue-600",
        success: "bg-emerald-50 text-emerald-600",
        error: "bg-red-50 text-red-600",
    }[type] || "bg-slate-100 text-slate-500");
}

function updateCompleteStep() {
    completeStatusCircle.className = "flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white text-sm font-bold";
    completeStatusCircle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`;
    completeStatusText.className = "text-sm text-emerald-600 font-semibold sm:inline";
}

function resetCompleteStep() {
    completeStatusCircle.className = "flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-500";
    completeStatusCircle.textContent = "2";
    completeStatusText.className = "hidden text-sm font-medium text-slate-400 sm:inline";
}

// =========================================================
// RETAKE / CLEAR
// =========================================================
function retakeScan() {
    scannedIdImage = null;
    scannedIdPreview.innerHTML = `<span class="text-xs text-slate-400">No image</span>`;
    scannedIdCapturedBadge.classList.add("hidden");
    resetCompleteStep();
    captureButton.disabled = !isSessionValid();
    captureButtonText.textContent = "Capture ID";
    scanStatus.textContent = "Ready to capture ID";
    cameraInstruction.textContent = "Position the ID inside the frame.";
    setOCRStatus("Waiting", "waiting");

    // Don't carry one person's signature into the next scan.
    clearSignature();

    showScreen("capture");
    startCamera();
}

function clearForm() {
    Object.values(fields).forEach(f => (f.value = ""));
}

// =========================================================
// E-SIGNATURE
// =========================================================
// Two drawing surfaces share the same pad logic:
//  - `signatureCanvas`   the small inline box on the review screen
//  - `fsSignatureCanvas` a big full-screen pad, opened on demand,
//                        meant to be much easier to sign on for
//                        senior citizens (bigger area, thicker ink).

const SIGNATURE_LINE_WIDTH = 4;    // thicker ink than the original 2px
const SIGNATURE_LINE_WIDTH_FS = 6; // thicker still on the full-screen pad
const SIGNATURE_COLOR = "#0f172a";

function makeSignaturePad(canvas, lineWidth) {
    const pad = {
        canvas,
        ctx: null,
        drawing: false,
        hasData: false,
        lineWidth,
        onStart: null,
        onClear: null,
    };

    function style() {
        pad.ctx.lineWidth = pad.lineWidth;
        pad.ctx.lineCap = "round";
        pad.ctx.lineJoin = "round";
        pad.ctx.strokeStyle = SIGNATURE_COLOR;
    }

    function getPos(event) {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false; // still hidden

        // Resizing a canvas wipes its bitmap and resets its drawing
        // state, so grab a snapshot first and restore it after — this
        // keeps a signature that's already been drawn if the box
        // resizes again later (e.g. on rotation).
        const snapshot = pad.hasData ? canvas.toDataURL("image/png") : null;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        pad.ctx = canvas.getContext("2d");
        pad.ctx.scale(dpr, dpr);
        style();

        if (snapshot) {
            const img = new Image();
            img.onload = () => pad.ctx.drawImage(img, 0, 0, rect.width, rect.height);
            img.src = snapshot;
        }
        return true;
    }

    function start(event) {
        if (!pad.ctx) return;
        event.preventDefault();
        pad.drawing = true;
        pad.hasData = true;
        canvas.setPointerCapture?.(event.pointerId);
        const pos = getPos(event);
        pad.ctx.beginPath();
        pad.ctx.moveTo(pos.x, pos.y);
        pad.onStart?.();
    }

    function move(event) {
        if (!pad.drawing || !pad.ctx) return;
        event.preventDefault();
        const pos = getPos(event);
        pad.ctx.lineTo(pos.x, pos.y);
        pad.ctx.stroke();
    }

    function end(event) {
        if (!pad.drawing) return;
        pad.drawing = false;
        try {
            canvas.releasePointerCapture?.(event.pointerId);
        } catch (error) {
            // Ignore pointer capture errors
        }
    }

    function clear() {
        if (pad.ctx) pad.ctx.clearRect(0, 0, canvas.width, canvas.height);
        pad.hasData = false;
        pad.onClear?.();
    }

    // Draws an existing signature image into this pad, scaled to fit
    // and centered — used to carry a signature between the small box
    // and the full-screen pad in either direction.
    function drawImageFrom(dataUrl) {
        if (!dataUrl || !pad.ctx) return;
        const rect = canvas.getBoundingClientRect();
        const img = new Image();
        img.onload = () => {
            pad.ctx.clearRect(0, 0, canvas.width, canvas.height);
            const scale = Math.min(rect.width / img.width, rect.height / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (rect.width - w) / 2;
            const y = (rect.height - h) / 2;
            pad.ctx.drawImage(img, x, y, w, h);
            pad.hasData = true;
        };
        img.src = dataUrl;
    }

    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("pointerleave", end);

    pad.resize = resize;
    pad.clear = clear;
    pad.drawImageFrom = drawImageFrom;
    pad.getImage = () => (pad.hasData ? canvas.toDataURL("image/png") : "");

    return pad;
}

const signaturePad = makeSignaturePad(signatureCanvas, SIGNATURE_LINE_WIDTH);
signaturePad.onStart = () => {
    signatureStatus.textContent = "Signature captured.";
    signatureStatus.className = "mt-1.5 text-[10px] text-emerald-600";
};
signaturePad.onClear = () => {
    signatureStatus.textContent = "Signature required before saving.";
    signatureStatus.className = "mt-1.5 text-[10px] text-slate-400";
};

// Built lazily the first time the full-screen pad is opened, since
// its canvas is display:none (inside the hidden overlay) at page load
// and can't be measured until then.
let fsSignaturePad = null;

function setupSignatureCanvas() {
    if (!signatureCanvas) return;

    // The signature box lives inside the review screen, which is
    // display:none at page load, so its bounding box is 0x0 at this
    // point — sizing has to happen again once the box is actually
    // visible. A ResizeObserver catches that transition (and any
    // later layout change, e.g. orientation); captureImage() also
    // calls resizeSignatureCanvas() directly right after showing
    // the review screen, as a fallback in case the observer doesn't
    // fire on the display:none -> block transition in every browser.
    const observer = new ResizeObserver(() => signaturePad.resize());
    observer.observe(signatureCanvas);

    clearSignatureButton?.addEventListener("click", () => signaturePad.clear());
    expandSignatureButton?.addEventListener("click", openSignatureFullscreen);
    fsSignatureClearButton?.addEventListener("click", () => fsSignaturePad?.clear());
    fsSignatureDoneButton?.addEventListener("click", closeSignatureFullscreenAndApply);
    fsSignatureCloseButton?.addEventListener("click", closeSignatureFullscreen);

    // Keep the full-screen pad correctly sized if the layout changes
    // while it's open — e.g. rotating the device, or the mobile
    // browser's address bar showing/hiding and changing the
    // available height. Observing here (rather than only on open)
    // means short-screen and orientation changes always keep Clear/
    // Done reachable and the canvas resolution correct.
    if (fsSignatureCanvas) {
        const fsObserver = new ResizeObserver(() => fsSignaturePad?.resize());
        fsObserver.observe(fsSignatureCanvas);
    }
}

function resizeSignatureCanvas() {
    signaturePad.resize();
}

function clearSignature() {
    signaturePad.clear();
}

function getSignatureImage() {
    return signaturePad.getImage();
}

// ---- Full-screen signing (bigger area + thicker ink for easier signing) ----
function openSignatureFullscreen() {
    if (!signatureFullscreenOverlay) return;

    signatureFullscreenOverlay.classList.remove("hidden");
    signatureFullscreenOverlay.classList.add("flex");
    document.body.style.overflow = "hidden"; // lock background scroll while signing

    if (!fsSignaturePad) {
        fsSignaturePad = makeSignaturePad(fsSignatureCanvas, SIGNATURE_LINE_WIDTH_FS);
    }

    // Wait a frame so the overlay has actually become visible/sized
    // before we measure it and size the canvas.
    requestAnimationFrame(() => {
        fsSignaturePad.resize();
        if (signaturePad.hasData) {
            fsSignaturePad.drawImageFrom(signaturePad.getImage());
        }
    });
}

function closeSignatureFullscreen() {
    if (!signatureFullscreenOverlay) return;
    signatureFullscreenOverlay.classList.add("hidden");
    signatureFullscreenOverlay.classList.remove("flex");
    document.body.style.overflow = "";
}

function closeSignatureFullscreenAndApply() {
    if (fsSignaturePad?.hasData) {
        signaturePad.drawImageFrom(fsSignaturePad.getImage());
        signatureStatus.textContent = "Signature captured.";
        signatureStatus.className = "mt-1.5 text-[10px] text-emerald-600";
    }
    closeSignatureFullscreen();
}

// =========================================================
// SAVE (used both for quick auto-save and manual Confirm & Save)
// =========================================================
function validateFields() {
    let firstInvalid = null;
    Object.values(fields).forEach(field => {
        field.classList.remove("border-red-500", "ring-2", "ring-red-500/10");
        if (!field.value.trim()) {
            field.classList.add("border-red-500", "ring-2", "ring-red-500/10");
            firstInvalid ??= field;
        }
    });
    return firstInvalid;
}

async function saveRecord() {
    const payload = {
        name: fields.name.value.trim(),
        birthdate: fields.birthdate.value.trim(),
        age: fields.age.value.trim(),
        sex: fields.sex.value.trim(),
        address: fields.address.value.trim(),
        idNumber: fields.idNumber.value.trim(),
        scannedIdImage,
        signatureImage: getSignatureImage()

    };

    // Note: this deliberately does NOT use mode: "no-cors". With
    // no-cors the response is opaque, so the app would report
    // "Successfully saved!" even when the server rejected the request
    // (expired session, bad data, quota error) and nothing was written.
    const result = await postToServer(payload);
    if (!result.success) throw new Error(result.message || "The server rejected the record.");
    return result;
}

// Manual save via the Confirm & Save button — used as a fallback if OCR/quick-save failed,
// or to save again after editing fields post quick-save.
async function submitToGoogleSheet() {
    if (!isSessionValid()) return lockApp("Your session has expired. Please enter your PIN again.");

    const firstInvalid = validateFields();

    if (firstInvalid) {
        return firstInvalid.focus();
    }

    if (!scannedIdImage) {
        return alert(
            "Scanned ID image is missing. Please capture the ID."
        );
    }

    if (!signaturePad.hasData) {
        signatureStatus.textContent =
            "Please provide a signature before saving.";

        signatureStatus.className =
            "mt-1.5 text-[10px] font-semibold text-red-600";

        return alert(
            "Please provide an electronic signature before saving."
        );
    }

    confirmButton.disabled = true;
    const originalText = confirmButton.textContent;
    confirmButton.textContent = "Saving...";

    try {
        await saveRecord();
        alert("Successfully saved!\n\nPerson information was saved to Google Sheets.\nThe scanned ID image was saved to Google Drive.");
        retakeScan();
    } catch (error) {
        console.error("Save error:", error);
        // lockApp() already explains itself for session problems.
        if (isSessionValid()) {
            alert("Failed to save the record.\n\n" + (error.message || "Please check your internet connection and try again."));
        }
    } finally {
        confirmButton.disabled = false;
        confirmButton.textContent = originalText;
    }
}

// =========================================================
// EVENTS
// =========================================================
captureButton.addEventListener("click", captureImage);
retakeButton.addEventListener("click", retakeScan);
clearButton.addEventListener("click", clearForm);
confirmButton.addEventListener("click", submitToGoogleSheet);

document.addEventListener("DOMContentLoaded", () => {
    setupSignatureCanvas();
    setupPinKeypad();

    // The app always boots locked. The camera is not started and the
    // capture/save buttons stay disabled until a PIN has been accepted
    // by the server.
    captureButton.disabled = true;
    confirmButton.disabled = true;
    document.body.classList.add("app-locked");
});
window.addEventListener("beforeunload", () => {
    stopCamera();
    // Drop the session server-side when the tab closes, so a token
    // can't be reused from a captured network log.
    if (sessionToken && navigator.sendBeacon) {
        navigator.sendBeacon(
            GOOGLE_SCRIPT_URL,
            new Blob([JSON.stringify({ action: "logout", token: sessionToken })],
                { type: "text/plain;charset=utf-8" })
        );
    }
});