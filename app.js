// =========================================================
// DOM ELEMENTS
// =========================================================

const GOOGLE_SCRIPT_URL =
    "https://script.google.com/a/macros/umindanao.edu.ph/s/AKfycbzBX6kB3ewjsjKrmPqcFcyH7Hh_Kd0yowxicqOA47eq-6yAnOQIOUnt6NceVv5ozswIFg/exec";

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

// =========================================================
// FORM FIELDS
// =========================================================

const nameField = document.getElementById("name");
const birthdateField = document.getElementById("birthdate");
const ageField = document.getElementById("age");
const sexField = document.getElementById("sex");
const nationalityField = document.getElementById("nationality");
const addressField = document.getElementById("address");
const idNumberField = document.getElementById("idNumber");
const idTypeField = document.getElementById("idType");

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

        cameraPlaceholder.classList.add("hidden");

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

    cameraPlaceholder.innerHTML = `
    < div class="px-6 text-center" >

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

        </ >
    `;
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

    const imageData = captureCanvas.toDataURL(
        "image/jpeg",
        0.90
    );

    // =====================================================
    // FRONT
    // =====================================================

    if (currentSide === "front") {

        frontImage = imageData;

        showFrontPreview(imageData);

        updateFrontCaptured();

        await runOCR(
            imageData,
            "front"
        );

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

        showBackPreview(imageData);

        updateBackCaptured();

        await runOCR(
            imageData,
            "back"
        );

        currentSide = "finished";

        updateCompleteStep();

        scanStatus.textContent =
            "Both sides captured — review the information";

        cameraInstruction.textContent =
            "Both sides have been captured.";

        captureButtonText.textContent =
            "Scan Complete";

        captureButton.disabled = true;

        captureButton.classList.remove(
            "bg-blue-600",
            "hover:bg-blue-700"
        );

        captureButton.classList.add(
            "bg-emerald-600",
            "cursor-not-allowed"
        );

        retakeButton.classList.remove("hidden");
        retakeButton.classList.add("flex");

        // =================================================
        // COMBINE OCR
        // =================================================

        combinedOCRText =
            `${frontOCRText} \n${backOCRText} `;

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
        // EXTRACT PERSON INFORMATION
        // =================================================

        extractPersonInformation();

        setOCRStatus(
            "Complete",
            "success"
        );
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
                            `Reading ${side} ${percent}% `,
                            "loading"
                        );
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
            `OCR error(${side}): `,
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
// FRONT PREVIEW
// =========================================================

function showFrontPreview(imageData) {

    frontPreview.innerHTML = `
    < img
src = "${imageData}"
alt = "Captured ID front"
class="h-full w-full object-cover"
    />
    `;
}

// =========================================================
// BACK PREVIEW
// =========================================================

function showBackPreview(imageData) {

    backPreview.innerHTML = `
    < img
src = "${imageData}"
alt = "Captured ID back"
class="h-full w-full object-cover"
    />
    `;
}

// =========================================================
// GET IMAGE DATA FROM PREVIEW
// =========================================================

function getPreviewImageData(previewElement) {

    if (!previewElement) {
        return "";
    }


    const image =
        previewElement.querySelector("img");


    if (!image) {
        return "";
    }


    return image.src || "";
}

// =========================================================
// FRONT CAPTURED
// =========================================================

function updateFrontCaptured() {

    frontCapturedBadge.classList.remove("hidden");

    frontStatusCircle.innerHTML = `
    < svg
xmlns = "http://www.w3.org/2000/svg"
class="h-4 w-4"
fill = "none"
viewBox = "0 0 24 24"
stroke = "currentColor"
stroke - width="2"
    >
    <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M5 13l4 4L19 7"
    />
        </ >
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
    < svg
xmlns = "http://www.w3.org/2000/svg"
class="h-4 w-4"
fill = "none"
viewBox = "0 0 24 24"
stroke = "currentColor"
stroke - width="2"
    >
    <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M5 13l4 4L19 7"
    />
        </ >
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
    < svg
xmlns = "http://www.w3.org/2000/svg"
class="h-4 w-4"
fill = "none"
viewBox = "0 0 24 24"
stroke = "currentColor"
stroke - width="2"
    >
    <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M5 13l4 4L19 7"
    />
        </ >
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
    // NATIONALITY
    // =====================================================

    const nationality =
        findNationality(text);

    if (nationality) {

        nationalityField.value =
            nationality;
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
    // ID TYPE
    // =====================================================

    const idType =
        findIDType(text);

    if (idType) {

        idTypeField.value =
            idType;
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
    console.log("Nationality:", nationality);
    console.log("Address:", address);
    console.log("ID Number:", idNumber);
    console.log("ID Type:", idType);
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
// FIND NATIONALITY
// =========================================================

function findNationality(text) {

    const upper =
        text.toUpperCase();

    const match =
        upper.match(
            /\bNATIONALITY\s*[:\-]?\s*([A-Z ]{3,30})/
        );

    if (match) {

        const value =
            cleanField(match[1]);

        // Stop at another known field
        return value
            .replace(
                /\b(SEX|ADDRESS|BIRTHDATE|BIRTH|DATE|ID|IDENTIFICATION)\b.*$/i,
                ""
            )
            .trim()
            .replace(/\s+/g, " ");
    }

    if (
        /\bFILIPINO\b/i.test(text) ||
        /\bPHILIPPINE\b/i.test(text)
    ) {
        return "Filipino";
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
// FIND ID TYPE
// =========================================================

function findIDType(text) {

    const upper =
        text.toUpperCase();

    const knownTypes = [

        "DRIVER'S LICENSE",
        "DRIVERS LICENSE",
        "DRIVER LICENSE",

        "PHILSYS ID",
        "PHILIPPINE IDENTIFICATION",
        "NATIONAL ID",

        "PASSPORT",
        "UMID",
        "POSTAL ID",
        "PRC ID",

        "SENIOR CITIZEN ID",

        "PERSON WITH DISABILITY ID",
        "PWD ID",

        "VOTER'S ID",
        "VOTERS ID",

        "SSS ID",
        "TIN ID",
        "PHILHEALTH ID"
    ];

    for (const type of knownTypes) {

        if (upper.includes(type)) {

            return formatIDType(type);
        }
    }

    return "";
}

// =========================================================
// FORMAT ID TYPE
// =========================================================

function formatIDType(value) {

    const replacements = {

        "DRIVERS LICENSE":
            "Driver's License",

        "DRIVER LICENSE":
            "Driver's License",

        "DRIVER'S LICENSE":
            "Driver's License",

        "PHILSYS ID":
            "PhilSys ID",

        "PHILIPPINE IDENTIFICATION":
            "PhilSys ID",

        "NATIONAL ID":
            "National ID",

        "PASSPORT":
            "Passport",

        "UMID":
            "UMID",

        "POSTAL ID":
            "Postal ID",

        "PRC ID":
            "PRC ID",

        "SENIOR CITIZEN ID":
            "Senior Citizen ID",

        "PERSON WITH DISABILITY ID":
            "PWD ID",

        "PWD ID":
            "PWD ID",

        "VOTER'S ID":
            "Voter's ID",

        "VOTERS ID":
            "Voter's ID",

        "SSS ID":
            "SSS ID",

        "TIN ID":
            "TIN ID",

        "PHILHEALTH ID":
            "PhilHealth ID"
    };

    return replacements[value] || value;
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
            upper.includes("NATIONALITY") ||
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
                upper.includes("NATIONALITY") ||
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
        upper === "NATIONALITY" ||
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
// RETAKE
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

    captureButton.classList.remove(
        "bg-emerald-600",
        "cursor-not-allowed"
    );

    captureButton.classList.add(
        "bg-blue-600",
        "hover:bg-blue-700"
    );

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
    // RESET OCR
    // =====================================================

    setOCRStatus(
        "Waiting",
        "waiting"
    );

    // =====================================================
    // HIDE RETAKE
    // =====================================================

    retakeButton.classList.add(
        "hidden"
    );

    retakeButton.classList.remove(
        "flex"
    );
}

// =========================================================
// CLEAR EVERYTHING
// =========================================================

function clearEverything() {

    retakeScan();

    // =====================================================
    // CLEAR FORM
    // =====================================================

    nameField.value = "";
    birthdateField.value = "";
    ageField.value = "";
    sexField.value = "";
    nationalityField.value = "";
    addressField.value = "";
    idNumberField.value = "";
    idTypeField.value = "";

    // =====================================================
    // RESTART CAMERA
    // =====================================================

    if (!cameraStream) {
        startCamera();
    }
}

// =========================================================
// CAPTURE BUTTON
// =========================================================

captureButton.addEventListener(
    "click",
    captureImage
);

// =========================================================
// RETAKE BUTTON
// =========================================================

retakeButton.addEventListener(
    "click",
    retakeScan
);

// =========================================================
// CLEAR BUTTON
// =========================================================

clearButton.addEventListener(
    "click",
    clearEverything
);

// =========================================================
// CONFIRM BUTTON
// =========================================================

async function submitToGoogleSheet() {

    // -------------------------------------------------
    // Get current values from the form
    // -------------------------------------------------

    const data = {
        name: nameInput.value.trim(),
        birthdate: birthdateInput.value.trim(),
        age: ageInput.value.trim(),
        sex: sexInput.value.trim(),
        nationality: nationalityInput.value.trim(),
        address: addressInput.value.trim(),
        idNumber: idNumberInput.value.trim(),
        idType: idTypeInput.value.trim()
    };


    // -------------------------------------------------
    // Basic validation
    // -------------------------------------------------

    if (!data.name) {
        alert("Please enter the person's name.");
        nameInput.focus();
        return;
    }

    if (!data.idNumber) {
        alert("Please enter the ID number.");
        idNumberInput.focus();
        return;
    }


    // -------------------------------------------------
    // Disable button while saving
    // -------------------------------------------------

    confirmButton.disabled = true;

    const originalText = confirmButton.textContent;

    confirmButton.textContent = "Saving...";


    try {

        // -------------------------------------------------
        // Send data to Google Apps Script
        // -------------------------------------------------

        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(data)
        });


        // -------------------------------------------------
        // Success
        // -------------------------------------------------

        alert("Successfully saved to Google Sheets.");


        // -------------------------------------------------
        // Clear scanner for next person
        // -------------------------------------------------

        clearEverything();


    } catch (error) {

        console.error(
            "Google Sheets submission error:",
            error
        );

        alert(
            "Failed to save the record.\n\n" +
            "Please check your internet connection and try again."
        );

    } finally {

        confirmButton.disabled = false;

        confirmButton.textContent = originalText;
    }
}

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

// =========================================================
// SUBMIT TO GOOGLE SHEETS + GOOGLE DRIVE
// =========================================================

async function submitToGoogleSheet() {

    // -----------------------------------------------------
    // Get person information
    // -----------------------------------------------------

    const data = {

        name:
            document.getElementById("name").value.trim(),

        birthdate:
            document.getElementById("birthdate").value.trim(),

        age:
            document.getElementById("age").value.trim(),

        sex:
            document.getElementById("sex").value.trim(),

        nationality:
            document.getElementById("nationality").value.trim(),

        address:
            document.getElementById("address").value.trim(),

        idNumber:
            document.getElementById("idNumber").value.trim(),

        idType:
            document.getElementById("idType").value.trim()
    };


    // -----------------------------------------------------
    // Get captured images
    // -----------------------------------------------------

    const frontImage =
        getPreviewImageData(frontPreview);

    const backImage =
        getPreviewImageData(backPreview);


    // -----------------------------------------------------
    // Validate information
    // -----------------------------------------------------

    if (!data.name) {

        alert(
            "Please enter the person's name."
        );

        document
            .getElementById("name")
            .focus();

        return;
    }


    if (!data.idNumber) {

        alert(
            "Please enter the ID number."
        );

        document
            .getElementById("idNumber")
            .focus();

        return;
    }


    // -----------------------------------------------------
    // Validate images
    // -----------------------------------------------------

    if (!frontImage) {

        alert(
            "Front ID image is missing."
        );

        return;
    }


    if (!backImage) {

        alert(
            "Back ID image is missing."
        );

        return;
    }


    // -----------------------------------------------------
    // Confirm button
    // -----------------------------------------------------

    const button =
        document.getElementById(
            "confirmButton"
        );


    const originalText =
        button
            ? button.textContent
            : "Confirm";


    if (button) {

        button.disabled = true;

        button.textContent =
            "Saving...";
    }


    try {

        // -------------------------------------------------
        // Prepare complete payload
        // -------------------------------------------------

        const payload = {

            name: data.name,

            birthdate: data.birthdate,

            age: data.age,

            sex: data.sex,

            nationality: data.nationality,

            address: data.address,

            idNumber: data.idNumber,

            idType: data.idType,

            frontImage: frontImage,

            backImage: backImage
        };


        // -------------------------------------------------
        // Send to Google Apps Script
        // -------------------------------------------------

        await fetch(
            GOOGLE_SCRIPT_URL,
            {
                method: "POST",

                mode: "no-cors",

                headers: {
                    "Content-Type":
                        "text/plain;charset=utf-8"
                },

                body:
                    JSON.stringify(payload)
            }
        );


        // -------------------------------------------------
        // Success
        // -------------------------------------------------

        alert(
            "Successfully saved!\n\n" +
            "Person information was saved to Google Sheets.\n" +
            "Front and back ID images were saved to Google Drive."
        );


        // -------------------------------------------------
        // Clear scanner
        // -------------------------------------------------

        clearEverything();


    } catch (error) {

        console.error(
            "Google Sheets / Drive submission error:",
            error
        );


        alert(
            "Failed to save the record.\n\n" +
            "Please check your internet connection and try again."
        );


    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                originalText;
        }
    }
}

document
    .getElementById("confirmButton")
    .addEventListener("click", submitToGoogleSheet);