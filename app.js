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

// Chips
const chipContainer = document.getElementById("chipContainer");
const noChipsMessage = document.getElementById("noChipsMessage");
const chipCount = document.getElementById("chipCount");

// =========================================================
// FORM FIELDS
// =========================================================

const nameField = document.getElementById("name");
const birthdateField = document.getElementById("birthdate");
const ageField = document.getElementById("age");
const sexField = document.getElementById("sex");
const addressField = document.getElementById("address");
const idNumberField = document.getElementById("idNumber");

const allFields = document.querySelectorAll("[data-field]");

// =========================================================
// VARIABLES
// =========================================================

let cameraStream = null;

let currentSide = "front";

let frontImage = null;
let backImage = null;

let frontOCRText = "";
let backOCRText = "";
let combinedOCRText = "";

let selectedChipEl = null;
let selectedChipText = null;

// =========================================================
// SCREEN SWITCHING
// =========================================================

function showScreen(name) {

    [captureScreen, processingScreen, reviewScreen].forEach(screen => {
        screen.classList.remove("active");
    });

    if (name === "capture") captureScreen.classList.add("active");
    if (name === "processing") processingScreen.classList.add("active");
    if (name === "review") reviewScreen.classList.add("active");
}

// =========================================================
// START CAMERA
// =========================================================

async function startCamera() {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        showCameraError(
            "Camera access is not supported by this browser."
        );

        return;
    }

    cameraPlaceholder.classList.add("hidden");
    cameraPlaceholder.classList.remove("flex");

    cameraLoading.classList.remove("hidden");
    cameraLoading.classList.add("flex");

    try {

        stopCamera();

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: {
                    ideal: 1280
                },

                height: {
                    ideal: 720
                },

                facingMode: "environment"
            },

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

        showCameraError(
            "Unable to access the camera. Please allow camera permission and try again."
        );
    }
}

// =========================================================
// STOP CAMERA
// =========================================================

function stopCamera() {

    if (!cameraStream) {
        return;
    }

    cameraStream.getTracks().forEach(track => {
        track.stop();
    });

    cameraStream = null;
    camera.srcObject = null;
}

// =========================================================
// CAMERA ERROR
// =========================================================

function showCameraError(message) {

    cameraPlaceholder.classList.remove("hidden");
    cameraPlaceholder.classList.add("flex");

    cameraPlaceholder.innerHTML = `
        <div class="px-6 text-center">

            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">

                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-8 w-8 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 9v3.75m0 3.75h.008M10.29 3.86l-7.07 12.25A1.5 1.5 0 004.52 18.36h14.96a1.5 1.5 0 001.3-2.25L13.71 3.86a1.5 1.5 0 00-2.6 0z"
                    />
                </svg>

            </div>

            <p class="text-sm font-medium text-white">
                Camera unavailable
            </p>

            <p class="mt-2 text-xs leading-relaxed text-slate-400">
                ${message}
            </p>

            <button
                type="button"
                onclick="startCamera()"
                class="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
                Try Again
            </button>

        </div>
    `;
}

// =========================================================
// COMPRESS IMAGE BEFORE UPLOAD
// =========================================================

function compressImage(canvas, maxWidth = 1000, quality = 0.75) {

    const scale = Math.min(
        1,
        maxWidth / canvas.width
    );

    const width = Math.round(
        canvas.width * scale
    );

    const height = Math.round(
        canvas.height * scale
    );

    const outputCanvas =
        document.createElement("canvas");

    outputCanvas.width = width;
    outputCanvas.height = height;

    const ctx =
        outputCanvas.getContext("2d");

    ctx.drawImage(
        canvas,
        0,
        0,
        width,
        height
    );

    return outputCanvas.toDataURL(
        "image/jpeg",
        quality
    );
}

// =========================================================
// CAPTURE IMAGE
// =========================================================

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

    const context = captureCanvas.getContext("2d");

    context.drawImage(
        camera,
        0,
        0,
        captureCanvas.width,
        captureCanvas.height
    );

    const imageData = compressImage(
        captureCanvas,
        1000,
        0.75
    );

    // =====================================================
    // FRONT
    // =====================================================

    if (currentSide === "front") {

        frontImage = imageData;

        showFrontPreview(imageData);

        updateFrontCaptured();

        captureButton.disabled = true;

        await runOCR(
            imageData,
            "front"
        );

        captureButton.disabled = false;

        currentSide = "back";

        updateBackStep();

        scanStatus.textContent =
            "Front captured — ready to capture back";

        cameraInstruction.textContent =
            "Turn the ID over and position the back inside the frame.";

        captureButtonText.textContent =
            "Capture Back";

        return;
    }

    // =====================================================
    // BACK
    // =====================================================

    if (currentSide === "back") {

        backImage = imageData;

        updateBackCaptured();

        captureButton.disabled = true;

        stopCamera();

        // Move to the processing screen while the back is read
        // and the fields are extracted — nothing else for the
        // person to do at this point but wait.
        processingText.textContent = "Reading the back of the ID...";
        showScreen("processing");

        await runOCR(
            imageData,
            "back"
        );

        currentSide = "finished";

        updateCompleteStep();

        // =================================================
        // COMBINE OCR
        // =================================================

        combinedOCRText =
            `${frontOCRText}\n${backOCRText}`;

        console.log(
            "========================================"
        );

        console.log(
            "COMBINED OCR RESULT"
        );

        console.log(
            "========================================"
        );

        console.log(
            combinedOCRText
        );

        // =================================================
        // EXTRACT PERSON INFORMATION (best-effort auto-fill)
        // =================================================

        extractPersonInformation();

        // =================================================
        // BUILD CHIPS (fallback for anything the extraction
        // got wrong or missed)
        // =================================================

        buildChips(combinedOCRText);

        // Now that both images and the form are ready, show
        // the review screen with the images and form together.
        showFrontPreview(frontImage);
        showBackPreview(backImage);

        setOCRStatus(
            "Complete",
            "success"
        );

        scanStatus.textContent =
            "Both sides captured — review the information";

        showScreen("review");
    }
}

// =========================================================
// TESSERACT OCR
// =========================================================

async function runOCR(imageData, side) {

    try {

        setOCRStatus(
            `Reading ${side}...`,
            "loading"
        );

        scanStatus.textContent =
            `Reading ${side} of ID...`;

        if (typeof Tesseract === "undefined") {

            throw new Error(
                "Tesseract.js was not loaded."
            );
        }

        const result = await Tesseract.recognize(
            imageData,
            "eng",
            {
                logger: function (info) {

                    if (
                        info.status === "recognizing text" &&
                        typeof info.progress === "number"
                    ) {

                        const percent =
                            Math.round(
                                info.progress * 100
                            );

                        setOCRStatus(
                            `Reading ${side} ${percent}%`,
                            "loading"
                        );

                        if (side === "back") {
                            processingText.textContent =
                                `Reading the back of the ID (${percent}%)...`;
                        }
                    }
                }
            }
        );

        const text =
            result.data.text || "";

        // =================================================
        // STORE RAW OCR
        // =================================================

        if (side === "front") {

            frontOCRText = text;

        } else {

            backOCRText = text;
        }

        console.log(
            `========== ${side.toUpperCase()} OCR ==========`
        );

        console.log(text);

        return text;

    } catch (error) {

        console.error(
            `OCR error (${side}): `,
            error
        );

        setOCRStatus(
            "OCR Failed",
            "error"
        );

        alert(
            `OCR failed while reading the ${side} of the ID.`
        );

        return "";
    }
}

// =========================================================
// OCR STATUS
// =========================================================

function setOCRStatus(message, type) {

    ocrStatus.textContent = message;

    ocrStatus.classList.remove(
        "bg-slate-100",
        "text-slate-500",
        "bg-blue-50",
        "text-blue-600",
        "bg-emerald-50",
        "text-emerald-600",
        "bg-red-50",
        "text-red-600"
    );

    if (type === "loading") {

        ocrStatus.classList.add(
            "bg-blue-50",
            "text-blue-600"
        );

    } else if (type === "success") {

        ocrStatus.classList.add(
            "bg-emerald-50",
            "text-emerald-600"
        );

    } else if (type === "error") {

        ocrStatus.classList.add(
            "bg-red-50",
            "text-red-600"
        );

    } else {

        ocrStatus.classList.add(
            "bg-slate-100",
            "text-slate-500"
        );
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
// FRONT CAPTURED
// =========================================================

function updateFrontCaptured() {

    frontCapturedBadge.classList.remove("hidden");

    frontStatusCircle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    `;

    frontStatusCircle.classList.remove(
        "bg-blue-600"
    );

    frontStatusCircle.classList.add(
        "bg-emerald-500"
    );

    frontStatusText.classList.remove(
        "text-blue-600"
    );

    frontStatusText.classList.add(
        "text-emerald-600"
    );
}

// =========================================================
// BACK STEP
// =========================================================

function updateBackStep() {

    backStatusCircle.classList.remove(
        "bg-slate-200",
        "text-slate-500"
    );

    backStatusCircle.classList.add(
        "bg-blue-600",
        "text-white"
    );

    backStatusText.classList.remove(
        "text-slate-400",
        "font-medium"
    );

    backStatusText.classList.add(
        "text-blue-600",
        "font-semibold"
    );
}

// =========================================================
// BACK CAPTURED
// =========================================================

function updateBackCaptured() {

    backCapturedBadge.classList.remove("hidden");

    backStatusCircle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    `;

    backStatusCircle.classList.remove(
        "bg-blue-600"
    );

    backStatusCircle.classList.add(
        "bg-emerald-500"
    );

    backStatusText.classList.remove(
        "text-blue-600"
    );

    backStatusText.classList.add(
        "text-emerald-600"
    );
}

// =========================================================
// COMPLETE STATUS
// =========================================================

function updateCompleteStep() {

    completeStatusCircle.classList.remove(
        "bg-slate-200",
        "text-slate-500"
    );

    completeStatusCircle.classList.add(
        "bg-emerald-500",
        "text-white"
    );

    completeStatusCircle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    `;

    completeStatusText.classList.remove(
        "text-slate-400"
    );

    completeStatusText.classList.add(
        "text-emerald-600",
        "font-semibold"
    );
}

// =========================================================
// EXTRACTED-TEXT CHIPS (tap-to-assign, for phone use)
// =========================================================

function buildChips(rawText) {

    chipContainer.innerHTML = "";
    selectedChipEl = null;
    selectedChipText = null;

    const lines = rawText
        .split(/\n/)
        .map(line => line.trim().replace(/\s+/g, " "))
        .filter(line => line.length > 1);

    const uniqueLines = [...new Set(lines)];

    chipCount.textContent =
        uniqueLines.length > 0 ? `(${uniqueLines.length})` : "";

    if (uniqueLines.length === 0) {
        noChipsMessage.classList.remove("hidden");
        return;
    }

    noChipsMessage.classList.add("hidden");

    uniqueLines.forEach(text => {

        const chip = document.createElement("button");

        chip.type = "button";

        chip.className =
            "chip rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-400";

        chip.textContent = text;

        chip.dataset.used = "false";
        chip.dataset.selected = "false";

        chip.addEventListener("click", () => onChipTap(chip, text));

        chipContainer.appendChild(chip);
    });
}

function onChipTap(chip, text) {

    // Tapping the already-selected chip deselects it.
    if (selectedChipEl === chip) {
        chip.dataset.selected = "false";
        selectedChipEl = null;
        selectedChipText = null;
        return;
    }

    if (selectedChipEl) {
        selectedChipEl.dataset.selected = "false";
    }

    chip.dataset.selected = "true";

    selectedChipEl = chip;
    selectedChipText = text;
}

// Tapping any field inserts the currently selected chip's text.
allFields.forEach(field => {

    field.addEventListener("focus", () => {

        if (!selectedChipText) {
            return;
        }

        field.value = selectedChipText;

        field.classList.add("field-flash");

        setTimeout(() => field.classList.remove("field-flash"), 500);

        if (selectedChipEl) {
            selectedChipEl.dataset.used = "true";
            selectedChipEl.dataset.selected = "false";
        }

        selectedChipEl = null;
        selectedChipText = null;

        // Avoid popping the on-screen keyboard right after an assign-tap.
        field.blur();
    });
});

// =========================================================
// EXTRACT PERSON INFORMATION
// =========================================================

function extractPersonInformation() {

    const text =
        combinedOCRText
            .replace(/\r/g, "\n");

    console.log(
        "========== EXTRACTION =========="
    );

    console.log(text);

    // =====================================================
    // BIRTHDATE
    // =====================================================

    const birthdate =
        findBirthdate(text);

    if (birthdate) {

        birthdateField.value =
            birthdate;

        const age =
            calculateAge(birthdate);

        if (age !== null) {

            ageField.value =
                age;
        }
    }

    // =====================================================
    // SEX
    // =====================================================

    const sex =
        findSex(text);

    if (sex) {

        sexField.value =
            sex;
    }

    // =====================================================
    // ID NUMBER
    // =====================================================

    const idNumber =
        findIDNumber(text);

    if (idNumber) {

        idNumberField.value =
            idNumber;
    }


    // =====================================================
    // NAME
    // =====================================================

    const name =
        findName(text);

    if (name) {

        nameField.value =
            name;
    }

    // =====================================================
    // ADDRESS
    // =====================================================

    const address =
        findAddress(text);

    if (address) {

        addressField.value =
            address;
    }

    // =====================================================
    // DEBUG
    // =====================================================

    console.log("Name:", name);
    console.log("Birthdate:", birthdate);
    console.log("Age:", ageField.value);
    console.log("Sex:", sex);
    console.log("Address:", address);
    console.log("ID Number:", idNumber);
}

// =========================================================
// FIND BIRTHDATE
// =========================================================

function findBirthdate(text) {

    const patterns = [

        // YYYY-MM-DD
        /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/,

        // MM/DD/YYYY
        /\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/,

        // DD MONTH YYYY
        /\b\d{1,2}\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|JAN|FEB|MAR|APR|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4}\b/i,

        // MONTH DD YYYY
        /\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|JAN|FEB|MAR|APR|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{1,2},?\s+\d{4}\b/i
    ];

    for (const pattern of patterns) {

        const match =
            text.match(pattern);

        if (match) {

            const normalized =
                normalizeDate(match[0]);

            if (normalized) {
                return normalized;
            }
        }
    }

    return "";
}

// =========================================================
// NORMALIZE DATE
// =========================================================

function normalizeDate(value) {

    value =
        value
            .trim()
            .replace(/\./g, "/")
            .replace(/-/g, "/");

    // =====================================================
    // YYYY/MM/DD
    // =====================================================

    let match =
        value.match(
            /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/
        );

    if (match) {

        return (
            `${match[2].padStart(2, "0")}/` +
            `${match[3].padStart(2, "0")}/` +
            `${match[1]}`
        );
    }

    // =====================================================
    // MM/DD/YYYY
    // =====================================================

    match =
        value.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
        );

    if (match) {

        return (
            `${match[1].padStart(2, "0")}/` +
            `${match[2].padStart(2, "0")}/` +
            `${match[3]}`
        );
    }

    // =====================================================
    // MONTH NAME
    // =====================================================

    const monthNames = {
        JAN: "01",
        JANUARY: "01",

        FEB: "02",
        FEBRUARY: "02",

        MAR: "03",
        MARCH: "03",

        APR: "04",
        APRIL: "04",

        MAY: "05",

        JUN: "06",
        JUNE: "06",

        JUL: "07",
        JULY: "07",

        AUG: "08",
        AUGUST: "08",

        SEP: "09",
        SEPTEMBER: "09",

        OCT: "10",
        OCTOBER: "10",

        NOV: "11",
        NOVEMBER: "11",

        DEC: "12",
        DECEMBER: "12"
    };

    match =
        value.match(
            /^(\d{1,2})\s+([A-Z]+)\s+(\d{4})$/i
        );

    if (match) {

        const day =
            match[1].padStart(2, "0");

        const month =
            monthNames[
            match[2].toUpperCase()
            ];

        const year =
            match[3];

        if (month) {

            return `${month}/${day}/${year}`;
        }
    }

    match =
        value.match(
            /^([A-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/i
        );

    if (match) {

        const month =
            monthNames[
            match[1].toUpperCase()
            ];

        const day =
            match[2].padStart(2, "0");

        const year =
            match[3];

        if (month) {

            return `${month}/${day}/${year}`;
        }
    }

    return "";
}

// =========================================================
// CALCULATE AGE
// =========================================================

function calculateAge(birthdate) {

    const parts =
        birthdate.split("/");

    if (parts.length !== 3) {
        return null;
    }

    const month =
        parseInt(parts[0], 10) - 1;

    const day =
        parseInt(parts[1], 10);

    const year =
        parseInt(parts[2], 10);

    if (
        Number.isNaN(month) ||
        Number.isNaN(day) ||
        Number.isNaN(year)
    ) {
        return null;
    }

    const birth =
        new Date(
            year,
            month,
            day
        );

    if (
        birth.getFullYear() !== year ||
        birth.getMonth() !== month ||
        birth.getDate() !== day
    ) {
        return null;
    }

    const today =
        new Date();

    let age =
        today.getFullYear() -
        birth.getFullYear();

    const birthdayPassed =
        (
            today.getMonth() > birth.getMonth()
        ) ||
        (
            today.getMonth() === birth.getMonth() &&
            today.getDate() >= birth.getDate()
        );

    if (!birthdayPassed) {
        age--;
    }

    return age >= 0
        ? age
        : null;
}

// =========================================================
// FIND SEX
// =========================================================

function findSex(text) {

    const upper =
        text.toUpperCase();

    // Labeled SEX field
    let match =
        upper.match(
            /\bSEX\s*[:\-]?\s*(FEMALE|MALE|F|M)\b/
        );

    if (match) {

        const value =
            match[1];

        if (
            value === "FEMALE" ||
            value === "F"
        ) {
            return "Female";
        }

        if (
            value === "MALE" ||
            value === "M"
        ) {
            return "Male";
        }
    }

    return "";
}


// =========================================================
// FIND ID NUMBER
// =========================================================

function findIDNumber(text) {

    const patterns = [

        // ID NO: ABC123456
        /\b(?:ID\s*(?:NO|NUMBER)|IDENTIFICATION\s*(?:NO|NUMBER))\s*[:#\-]?\s*([A-Z0-9\-]{5,30})\b/i,

        // Example: ABC-123456
        /\b[A-Z]{1,4}-\d{4,15}\b/i,

        // Example: 14-000735
        /\b\d{2}-\d{5,15}\b/

    ];

    for (const pattern of patterns) {

        const match =
            text.match(pattern);

        if (!match) {
            continue;
        }

        if (match[1]) {

            return match[1]
                .trim();
        }

        return match[0]
            .trim();
    }

    return "";
}


// =========================================================
// FIND NAME
// =========================================================

function findName(text) {

    const lines =
        text
            .split(/\n/)
            .map(line =>
                line
                    .trim()
                    .replace(/\s+/g, " ")
            )
            .filter(Boolean);

    // =====================================================
    // LABELED NAME
    // =====================================================

    for (let i = 0; i < lines.length; i++) {

        const line =
            lines[i];

        const match =
            line.match(
                /^(?:NAME|FULL NAME)\s*[:\-]?\s*(.+)$/i
            );

        if (match) {

            const candidate =
                cleanName(match[1]);

            if (
                isPossibleName(candidate)
            ) {
                return candidate;
            }

            if (
                lines[i + 1] &&
                isPossibleName(
                    cleanName(lines[i + 1])
                )
            ) {

                return cleanName(
                    lines[i + 1]
                );
            }
        }
    }

    // =====================================================
    // COMMON PHILIPPINE ID FORMAT
    // =====================================================

    const nameCandidates = [];

    for (const line of lines) {

        const cleaned =
            cleanName(line);

        if (
            isPossibleName(cleaned)
        ) {

            nameCandidates.push(
                cleaned
            );
        }
    }

    for (const candidate of nameCandidates) {

        const upper =
            candidate.toUpperCase();

        if (
            upper.includes("REPUBLIC") ||
            upper.includes("PHILIPPINES") ||
            upper.includes("ADDRESS") ||
            upper.includes("BIRTH") ||
            upper.includes("DATE") ||
            upper.includes("LICENSE") ||
            upper.includes("IDENTIFICATION") ||
            upper.includes("PASSPORT") ||
            upper.includes("NATIONAL ID")
        ) {
            continue;
        }

        if (
            candidate
                .split(" ")
                .length >= 2
        ) {

            return candidate;
        }
    }

    return "";
}

// =========================================================
// CLEAN NAME
// =========================================================

function cleanName(value) {

    return value
        .replace(
            /[^A-Za-zÀ-ÿ.'\- ]/g,
            ""
        )
        .replace(/\s+/g, " ")
        .trim();
}

// =========================================================
// POSSIBLE NAME
// =========================================================

function isPossibleName(value) {

    if (!value) {
        return false;
    }

    const words =
        value.split(" ");

    if (words.length < 2) {
        return false;
    }

    if (value.length < 4) {
        return false;
    }

    return words.every(word =>
        /^[A-Za-zÀ-ÿ.'\-]+$/.test(word)
    );
}

// =========================================================
// FIND ADDRESS
// =========================================================

function findAddress(text) {

    const lines =
        text
            .split(/\n/)
            .map(line =>
                line
                    .trim()
                    .replace(/\s+/g, " ")
            )
            .filter(Boolean);

    // =====================================================
    // LABELED ADDRESS
    // =====================================================

    for (let i = 0; i < lines.length; i++) {

        const line =
            lines[i];

        const match =
            line.match(
                /^ADDRESS\s*[:\-]?\s*(.*)$/i
            );

        if (!match) {
            continue;
        }

        let address =
            match[1].trim();

        for (
            let j = i + 1;
            j < Math.min(i + 4, lines.length);
            j++
        ) {

            const next =
                lines[j];

            const upper =
                next.toUpperCase();

            if (
                upper.includes("BIRTH") ||
                upper.includes("SEX") ||
                upper.includes("DATE OF BIRTH") ||
                upper.includes("ID NO") ||
                upper.includes("ID NUMBER")
            ) {
                break;
            }

            if (
                isPossibleAddressLine(next)
            ) {

                address =
                    address
                        ? `${address}, ${next}`
                        : next;
            }
        }

        if (address) {
            return address;
        }
    }

    // =====================================================
    // FALLBACK
    // =====================================================

    const addressLines =
        lines.filter(line => {

            const upper =
                line.toUpperCase();

            return (
                /\b(ST|STREET|ROAD|RD|AVE|AVENUE|BLVD|BARANGAY|BRGY|CITY|DAVAO|VILLAGE)\b/
                    .test(upper)
            );
        });

    if (addressLines.length) {

        return addressLines
            .slice(0, 3)
            .join(", ");
    }

    return "";
}

// =========================================================
// POSSIBLE ADDRESS LINE
// =========================================================

function isPossibleAddressLine(value) {

    if (!value) {
        return false;
    }

    const upper =
        value.toUpperCase();

    if (
        upper === "ADDRESS" ||
        upper === "SEX"
    ) {
        return false;
    }

    return (
        value.length >= 4 &&
        /[A-Za-z0-9]/.test(value)
    );
}

// =========================================================
// CLEAN FIELD
// =========================================================

function cleanField(value) {

    return value
        .replace(/\s+/g, " ")
        .trim();
}

// =========================================================
// RETAKE (full rescan — back to the capture screen)
// =========================================================

function retakeScan() {

    frontImage = null;
    backImage = null;

    frontOCRText = "";
    backOCRText = "";
    combinedOCRText = "";

    currentSide = "front";

    // =====================================================
    // RESET PREVIEWS
    // =====================================================

    frontPreview.innerHTML = `
        <span class="text-xs text-slate-400">
            No image
        </span>
    `;

    backPreview.innerHTML = `
        <span class="text-xs text-slate-400">
            No image
        </span>
    `;

    // =====================================================
    // RESET BADGES
    // =====================================================

    frontCapturedBadge.classList.add(
        "hidden"
    );

    backCapturedBadge.classList.add(
        "hidden"
    );

    // =====================================================
    // RESET FRONT
    // =====================================================

    frontStatusCircle.innerHTML = "1";

    frontStatusCircle.classList.remove(
        "bg-emerald-500"
    );

    frontStatusCircle.classList.add(
        "bg-blue-600"
    );

    frontStatusText.classList.remove(
        "text-emerald-600"
    );

    frontStatusText.classList.add(
        "text-blue-600"
    );

    // =====================================================
    // RESET BACK
    // =====================================================

    backStatusCircle.innerHTML = "2";

    backStatusCircle.classList.remove(
        "bg-blue-600",
        "bg-emerald-500",
        "text-white"
    );

    backStatusCircle.classList.add(
        "bg-slate-200",
        "text-slate-500"
    );

    backStatusText.classList.remove(
        "text-blue-600",
        "text-emerald-600",
        "font-semibold"
    );

    backStatusText.classList.add(
        "text-slate-400",
        "font-medium"
    );

    // =====================================================
    // RESET COMPLETE
    // =====================================================

    completeStatusCircle.innerHTML = "3";

    completeStatusCircle.classList.remove(
        "bg-emerald-500",
        "text-white"
    );

    completeStatusCircle.classList.add(
        "bg-slate-200",
        "text-slate-500"
    );

    completeStatusText.classList.remove(
        "text-emerald-600",
        "font-semibold"
    );

    completeStatusText.classList.add(
        "text-slate-400",
        "font-medium"
    );

    // =====================================================
    // RESET CAPTURE BUTTON
    // =====================================================

    captureButton.disabled = false;

    captureButtonText.textContent =
        "Capture Front";

    // =====================================================
    // RESET TEXT
    // =====================================================

    scanStatus.textContent =
        "Ready to capture front";

    cameraInstruction.textContent =
        "Position the front of the ID inside the frame.";

    // =====================================================
    // RESET OCR + CHIPS
    // =====================================================

    setOCRStatus(
        "Waiting",
        "waiting"
    );

    chipContainer.innerHTML = "";
    noChipsMessage.classList.add("hidden");
    chipCount.textContent = "";
    selectedChipEl = null;
    selectedChipText = null;

    const chipsPanel = document.getElementById("chipsPanel");
    if (chipsPanel) chipsPanel.open = false;

    // =====================================================
    // BACK TO CAPTURE SCREEN
    // =====================================================

    showScreen("capture");

    startCamera();
}

// =========================================================
// CLEAR — wipes the form only, keeps the scanned images
// and extracted text so the person doesn't have to rescan
// just to fix a couple of fields.
// =========================================================

function clearForm() {

    allFields.forEach(field => {
        field.value = "";
    });

    chipContainer.querySelectorAll(".chip").forEach(chip => {
        chip.dataset.used = "false";
        chip.dataset.selected = "false";
    });

    selectedChipEl = null;
    selectedChipText = null;
}

// =========================================================
// BUTTON WIRING
// =========================================================

captureButton.addEventListener(
    "click",
    captureImage
);

retakeButton.addEventListener(
    "click",
    retakeScan
);

clearButton.addEventListener(
    "click",
    clearForm
);

// =========================================================
// SUBMIT TO GOOGLE SHEETS + GOOGLE DRIVE
// =========================================================

async function submitToGoogleSheet() {


    const requiredFields = [
        document.getElementById("name"),
        document.getElementById("birthdate"),
        document.getElementById("age"),
        document.getElementById("sex"),
        document.getElementById("address"),
        document.getElementById("idNumber")
    ];

    let firstInvalidField = null;

    requiredFields.forEach(field => {

        field.classList.remove(
            "border-red-500",
            "ring-2",
            "ring-red-500/10"
        );

        if (!field.value.trim()) {

            field.classList.add(
                "border-red-500",
                "ring-2",
                "ring-red-500/10"
            );

            if (!firstInvalidField) {
                firstInvalidField = field;
            }
        }

    });


    // Stop saving if something is missing
    if (firstInvalidField) {

        firstInvalidField.focus();

        return;
    }


    const data = {
        name: nameField.value.trim(),
        birthdate: birthdateField.value.trim(),
        age: ageField.value.trim(),
        sex: sexField.value.trim(),
        address: addressField.value.trim(),
        idNumber: idNumberField.value.trim(),
    };

    if (!data.name) {
        alert("Please enter the person's name.");
        nameField.focus();
        return;
    }

    if (!data.idNumber) {
        alert("Please enter the ID number.");
        idNumberField.focus();
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

        const payload = { ...data, frontImage, backImage };

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

        alert(
            "Failed to save the record.\n\n" +
            "Please check your internet connection and try again."
        );

    } finally {
        confirmButton.disabled = false;
        confirmButton.textContent = originalText;
    }
}

confirmButton.addEventListener("click", submitToGoogleSheet);

// =========================================================
// PAGE LOAD
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        startCamera();
    }
);

// =========================================================
// PAGE CLOSE
// =========================================================

window.addEventListener(
    "beforeunload",
    function () {

        stopCamera();
    }
);