// =========================================================
// CONFIG
// =========================================================

const GOOGLE_SCRIPT_URL =
    "https://script.google.com/a/macros/umindanao.edu.ph/s/AKfycbzBX6kB3ewjsjKrmPqcFcyH7Hh_Kd0yowxicqOA47eq-6yAnOQIOUnt6NceVv5ozswIFg/exec";

// =========================================================
// DOM ELEMENTS
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

const frontPreview = document.getElementById("frontPreview");
const backPreview = document.getElementById("backPreview");

const frontCapturedBadge = document.getElementById("frontCapturedBadge");
const backCapturedBadge = document.getElementById("backCapturedBadge");

const frontStatusCircle = document.getElementById("frontStatusCircle");
const frontStatusText = document.getElementById("frontStatusText");

const backStatusCircle = document.getElementById("backStatusCircle");
const backStatusText = document.getElementById("backStatusText");

const completeStatusCircle = document.getElementById("completeStatusCircle");
const completeStatusText = document.getElementById("completeStatusText");

// Screens
const captureScreen = document.getElementById("captureScreen");
const processingScreen = document.getElementById("processingScreen");
const reviewScreen = document.getElementById("reviewScreen");
const processingText = document.getElementById("processingText");

// Form fields
const nameField = document.getElementById("name");
const birthdateField = document.getElementById("birthdate");
const ageField = document.getElementById("age");
const sexField = document.getElementById("sex");
const addressField = document.getElementById("address");
const idNumberField = document.getElementById("idNumber");

// =========================================================
// STATE
// =========================================================

let cameraStream = null;
let currentSide = "front";
let frontImage = null;
let backImage = null;

// =========================================================
// SCREEN SWITCHING
// =========================================================

function showScreen(name) {
    [captureScreen, processingScreen, reviewScreen].forEach(screen =>
        screen.classList.remove("active")
    );

    if (name === "capture") captureScreen.classList.add("active");
    if (name === "processing") processingScreen.classList.add("active");
    if (name === "review") reviewScreen.classList.add("active");
}

// =========================================================
// CAMERA
// =========================================================

async function startCamera() {

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showCameraError("Camera access is not supported by this browser.");
        return;
    }

    cameraPlaceholder.classList.add("hidden");
    cameraPlaceholder.classList.remove("flex");
    cameraLoading.classList.remove("hidden");
    cameraLoading.classList.add("flex");

    try {
        stopCamera();

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
            audio: false
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
    if (!cameraStream) return;

    cameraStream.getTracks().forEach(track => track.stop());
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
            <button type="button" onclick="startCamera()" class="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                Try Again
            </button>
        </div>
    `;
}

// =========================================================
// IMAGE CAPTURE / COMPRESSION
// =========================================================

function compressImage(canvas, maxWidth = 800, quality = 0.60) {
    const scale = Math.min(1, maxWidth / canvas.width);
    const width = Math.round(canvas.width * scale);
    const height = Math.round(canvas.height * scale);

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = width;
    outputCanvas.height = height;

    outputCanvas.getContext("2d").drawImage(canvas, 0, 0, width, height);

    return outputCanvas.toDataURL("image/jpeg", quality);
}

async function captureImage() {

    if (!cameraStream) {
        alert("Camera is not active.");
        return;
    }

    if (!camera.videoWidth || !camera.videoHeight) {
        alert("Camera is not ready yet.");
        return;
    }

    captureCanvas.width = camera.videoWidth;
    captureCanvas.height = camera.videoHeight;

    captureCanvas.getContext("2d").drawImage(
        camera, 0, 0, captureCanvas.width, captureCanvas.height
    );

    const imageData = compressImage(captureCanvas, 800, 0.60);

    if (currentSide === "front") {
        frontImage = imageData;

        showFrontPreview(imageData);
        updateFrontCaptured();

        currentSide = "back";
        updateBackStep();

        scanStatus.textContent = "Front captured — ready to capture back";
        cameraInstruction.textContent = "Turn the ID over and position the back inside the frame.";
        captureButtonText.textContent = "Capture Back";

        return;
    }

    if (currentSide === "back") {
        backImage = imageData;
        updateBackCaptured();

        captureButton.disabled = true;
        stopCamera();

        processingText.textContent = "Reading the ID...";
        showScreen("processing");
        setOCRStatus("Extracting...", "loading");

        try {
            const extracted = await extractIdData(frontImage, backImage);
            applyExtractedData(extracted);
            setOCRStatus("Complete", "success");
        } catch (error) {
            console.error("Extraction error:", error);
            setOCRStatus("Extraction failed", "error");
            alert("Could not read the ID automatically. Please fill in the details manually.");
        }

        currentSide = "finished";
        updateCompleteStep();

        showFrontPreview(frontImage);
        showBackPreview(backImage);

        scanStatus.textContent = "Both sides captured — review the information";
        captureButton.disabled = false;

        showScreen("review");
    }
}

// =========================================================
// STRUCTOCR EXTRACTION (proxied through the Apps Script
// backend so the API key never lives in client-side code)
// =========================================================

async function extractIdData(front, back) {

    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
            action: "extract",
            frontImage: front,
            backImage: back
        })
    });

    // Read as text first so a non-JSON response (e.g. an
    // Apps Script authorization/login page) is visible in the
    // console instead of just failing silently on .json().
    const rawText = await response.text();

    console.log("Raw /extract response:", rawText);

    let result;

    try {
        result = JSON.parse(rawText);
    } catch (parseError) {
        throw new Error(
            "Server did not return valid JSON (likely a deployment/access issue). " +
            "See console for the raw response."
        );
    }

    if (!result.success) {
        throw new Error(result.message || "Extraction failed.");
    }

    return result.data;
}

function applyExtractedData(data) {

    if (!data) return;

    if (data.name) nameField.value = data.name;

    if (data.birthdate) {
        const formatted = toMMDDYYYY(data.birthdate);
        birthdateField.value = formatted;

        const age = calculateAge(formatted);
        if (age !== null) ageField.value = age;
    }

    if (data.sex) {
        sexField.value =
            data.sex === "M" ? "Male" :
                data.sex === "F" ? "Female" :
                    data.sex;
    }

    if (data.address) addressField.value = data.address;
    if (data.idNumber) idNumberField.value = data.idNumber;
}

// StructOCR returns YYYY-MM-DD; the form uses MM/DD/YYYY.
function toMMDDYYYY(isoDate) {
    const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[2]}/${match[3]}/${match[1]}` : isoDate;
}

function calculateAge(birthdateMMDDYYYY) {

    const parts = birthdateMMDDYYYY.split("/");
    if (parts.length !== 3) return null;

    const month = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(year)) return null;

    const birth = new Date(year, month, day);
    if (birth.getFullYear() !== year || birth.getMonth() !== month || birth.getDate() !== day) {
        return null;
    }

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();

    const birthdayPassed =
        today.getMonth() > birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());

    if (!birthdayPassed) age--;

    return age >= 0 ? age : null;
}

// =========================================================
// OCR STATUS BADGE
// =========================================================

function setOCRStatus(message, type) {

    ocrStatus.textContent = message;

    ocrStatus.classList.remove(
        "bg-slate-100", "text-slate-500",
        "bg-blue-50", "text-blue-600",
        "bg-emerald-50", "text-emerald-600",
        "bg-red-50", "text-red-600"
    );

    if (type === "loading") {
        ocrStatus.classList.add("bg-blue-50", "text-blue-600");
    } else if (type === "success") {
        ocrStatus.classList.add("bg-emerald-50", "text-emerald-600");
    } else if (type === "error") {
        ocrStatus.classList.add("bg-red-50", "text-red-600");
    } else {
        ocrStatus.classList.add("bg-slate-100", "text-slate-500");
    }
}

// =========================================================
// PREVIEW RENDERING
// =========================================================

function showFrontPreview(imageData) {
    frontPreview.innerHTML = `<img src="${imageData}" alt="Captured ID front" class="h-full w-full object-cover">`;
}

function showBackPreview(imageData) {
    backPreview.innerHTML = `<img src="${imageData}" alt="Captured ID back" class="h-full w-full object-cover">`;
}

// =========================================================
// STEP INDICATORS
// =========================================================

function updateFrontCaptured() {
    frontCapturedBadge.classList.remove("hidden");

    frontStatusCircle.innerHTML = checkmarkSVG();
    frontStatusCircle.classList.remove("bg-blue-600");
    frontStatusCircle.classList.add("bg-emerald-500");

    frontStatusText.classList.remove("text-blue-600");
    frontStatusText.classList.add("text-emerald-600");
}

function updateBackStep() {
    backStatusCircle.classList.remove("bg-slate-200", "text-slate-500");
    backStatusCircle.classList.add("bg-blue-600", "text-white");

    backStatusText.classList.remove("text-slate-400", "font-medium");
    backStatusText.classList.add("text-blue-600", "font-semibold");
}

function updateBackCaptured() {
    backCapturedBadge.classList.remove("hidden");

    backStatusCircle.innerHTML = checkmarkSVG();
    backStatusCircle.classList.remove("bg-blue-600");
    backStatusCircle.classList.add("bg-emerald-500");

    backStatusText.classList.remove("text-blue-600");
    backStatusText.classList.add("text-emerald-600");
}

function updateCompleteStep() {
    completeStatusCircle.classList.remove("bg-slate-200", "text-slate-500");
    completeStatusCircle.classList.add("bg-emerald-500", "text-white");
    completeStatusCircle.innerHTML = checkmarkSVG();

    completeStatusText.classList.remove("text-slate-400");
    completeStatusText.classList.add("text-emerald-600", "font-semibold");
}

function checkmarkSVG() {
    return `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    `;
}

// =========================================================
// RETAKE — full rescan, back to the capture screen
// =========================================================

function retakeScan() {

    frontImage = null;
    backImage = null;
    currentSide = "front";

    frontPreview.innerHTML = `<span class="text-xs text-slate-400">No image</span>`;
    backPreview.innerHTML = `<span class="text-xs text-slate-400">No image</span>`;

    frontCapturedBadge.classList.add("hidden");
    backCapturedBadge.classList.add("hidden");

    frontStatusCircle.innerHTML = "1";
    frontStatusCircle.classList.remove("bg-emerald-500");
    frontStatusCircle.classList.add("bg-blue-600");
    frontStatusText.classList.remove("text-emerald-600");
    frontStatusText.classList.add("text-blue-600");

    backStatusCircle.innerHTML = "2";
    backStatusCircle.classList.remove("bg-blue-600", "bg-emerald-500", "text-white");
    backStatusCircle.classList.add("bg-slate-200", "text-slate-500");
    backStatusText.classList.remove("text-blue-600", "text-emerald-600", "font-semibold");
    backStatusText.classList.add("text-slate-400", "font-medium");

    completeStatusCircle.innerHTML = "3";
    completeStatusCircle.classList.remove("bg-emerald-500", "text-white");
    completeStatusCircle.classList.add("bg-slate-200", "text-slate-500");
    completeStatusText.classList.remove("text-emerald-600", "font-semibold");
    completeStatusText.classList.add("text-slate-400", "font-medium");

    captureButton.disabled = false;
    captureButtonText.textContent = "Capture Front";

    scanStatus.textContent = "Ready to capture front";
    cameraInstruction.textContent = "Position the front of the ID inside the frame.";

    setOCRStatus("Waiting", "waiting");

    showScreen("capture");
    startCamera();
}

// =========================================================
// CLEAR — wipes the form only, keeps the scanned images
// so the person doesn't have to rescan just to fix a field.
// =========================================================

function clearForm() {
    document.querySelectorAll("[data-field]").forEach(field => (field.value = ""));
}

// =========================================================
// BUTTON WIRING
// =========================================================

captureButton.addEventListener("click", captureImage);
retakeButton.addEventListener("click", retakeScan);
clearButton.addEventListener("click", clearForm);

// =========================================================
// SUBMIT TO GOOGLE SHEETS + GOOGLE DRIVE
// =========================================================

async function submitToGoogleSheet() {

    const requiredFields = [nameField, birthdateField, ageField, sexField, addressField, idNumberField];
    let firstInvalidField = null;

    requiredFields.forEach(field => {
        field.classList.remove("border-red-500", "ring-2", "ring-red-500/10");

        if (!field.value.trim()) {
            field.classList.add("border-red-500", "ring-2", "ring-red-500/10");
            if (!firstInvalidField) firstInvalidField = field;
        }
    });

    if (firstInvalidField) {
        firstInvalidField.focus();
        return;
    }

    if (!frontImage) {
        alert("Front ID image is missing. Please capture the front of the ID.");
        return;
    }

    if (!backImage) {
        alert("Back ID image is missing. Please capture the back of the ID.");
        return;
    }

    confirmButton.disabled = true;
    const originalText = confirmButton.textContent;
    confirmButton.textContent = "Saving...";

    try {
        const payload = {
            name: nameField.value.trim(),
            birthdate: birthdateField.value.trim(),
            age: ageField.value.trim(),
            sex: sexField.value.trim(),
            address: addressField.value.trim(),
            idNumber: idNumberField.value.trim(),
            frontImage,
            backImage
        };

        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });

        alert(
            "Successfully saved!\n\n" +
            "Person information was saved to Google Sheets.\n" +
            "Front and back ID images were saved to Google Drive."
        );

        retakeScan();

    } catch (error) {
        console.error("Google Sheets / Drive submission error:", error);
        alert("Failed to save the record.\n\nPlease check your internet connection and try again.");

    } finally {
        confirmButton.disabled = false;
        confirmButton.textContent = originalText;
    }
}

confirmButton.addEventListener("click", submitToGoogleSheet);

// =========================================================
// PAGE LIFECYCLE
// =========================================================

document.addEventListener("DOMContentLoaded", startCamera);
window.addEventListener("beforeunload", stopCamera);