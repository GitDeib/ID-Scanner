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

// Raw OCR text.
// We keep these separately so we can improve extraction later.
let frontOCRText = "";
let backOCRText = "";
let combinedOCRText = "";

// =========================================================
// START CAMERA
// =========================================================

async function startCamera() {


    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {

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


    /*
    |--------------------------------------------------------------------------
    | Capture current video frame
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | Convert to JPEG
    |--------------------------------------------------------------------------
    */

    const imageData = captureCanvas.toDataURL(
        "image/jpeg",
        0.90
    );


    /*
    |--------------------------------------------------------------------------
    | FRONT
    |--------------------------------------------------------------------------
    */

    if (currentSide === "front") {

        frontImage = imageData;

        showFrontPreview(imageData);

        updateFrontCaptured();


        /*
        |--------------------------------------------------------------------------
        | OCR FRONT
        |--------------------------------------------------------------------------
        */

        await runOCR(
            imageData,
            "front"
        );


        /*
        |--------------------------------------------------------------------------
        | Move to BACK
        |--------------------------------------------------------------------------
        */

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


    /*
    |--------------------------------------------------------------------------
    | BACK
    |--------------------------------------------------------------------------
    */

    if (currentSide === "back") {

        backImage = imageData;

        showBackPreview(imageData);

        updateBackCaptured();


        /*
        |--------------------------------------------------------------------------
        | OCR BACK
        |--------------------------------------------------------------------------
        */

        await runOCR(
            imageData,
            "back"
        );


        /*
        |--------------------------------------------------------------------------
        | FINISHED
        |--------------------------------------------------------------------------
        */

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


        /*
        |--------------------------------------------------------------------------
        | FINAL OCR
        |--------------------------------------------------------------------------
        */

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


        /*
        |--------------------------------------------------------------------------
        | Extract information
        |--------------------------------------------------------------------------
        */

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

async function runOCR(
    imageData,
    side
) {


    try {

        setOCRStatus(
            `Reading ${side}...`,
            "loading"
        );


        scanStatus.textContent =
            `Reading ${side} of ID...`;


        /*
        |--------------------------------------------------------------------------
        | Make sure Tesseract exists
        |--------------------------------------------------------------------------
        */

        if (typeof Tesseract === "undefined") {

            throw new Error(
                "Tesseract.js was not loaded."
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Run OCR
        |--------------------------------------------------------------------------
        */

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


        /*
        |--------------------------------------------------------------------------
        | Store raw OCR result
        |--------------------------------------------------------------------------
        */

        if (side === "front") {

            frontOCRText = text;

        } else {

            backOCRText = text;

        }


        /*
        |--------------------------------------------------------------------------
        | Console output
        |--------------------------------------------------------------------------
        */

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

function setOCRStatus(
    message,
    type
) {


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
// SHOW FRONT PREVIEW
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
// SHOW BACK PREVIEW
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
// FRONT CAPTURED
// =========================================================

function updateFrontCaptured() {


    frontCapturedBadge.classList.remove(
        "hidden"
    );


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


    backCapturedBadge.classList.remove(
        "hidden"
    );


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
// BASIC PERSON INFORMATION EXTRACTION
// =========================================================

function extractPersonInformation() {


    const text =
        combinedOCRText
            .replace(/\r/g, "\n");


    console.log(
        "========== EXTRACTION =========="
    );


    /*
    |--------------------------------------------------------------------------
    | Birthdate
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | Sex
    |--------------------------------------------------------------------------
    */

    const sex =
        findSex(text);


    if (sex) {

        sexField.value =
            sex;

    }


    /*
    |--------------------------------------------------------------------------
    | Nationality
    |--------------------------------------------------------------------------
    */

    const nationality =
        findNationality(text);


    if (nationality) {

        nationalityField.value =
            nationality;

    }


    /*
    |--------------------------------------------------------------------------
    | ID Number
    |--------------------------------------------------------------------------
    */

    const idNumber =
        findIDNumber(text);


    if (idNumber) {

        idNumberField.value =
            idNumber;

    }


    /*
    |--------------------------------------------------------------------------
    | ID Type
    |--------------------------------------------------------------------------
    */

    const idType =
        findIDType(text);


    if (idType) {

        idTypeField.value =
            idType;

    }


    /*
    |--------------------------------------------------------------------------
    | Name
    |--------------------------------------------------------------------------
    */

    const name =
        findName(text);


    if (name) {

        nameField.value =
            name;

    }


    /*
    |--------------------------------------------------------------------------
    | Address
    |--------------------------------------------------------------------------
    */

    const address =
        findAddress(text);


    if (address) {

        addressField.value =
            address;

    }


    console.log(
        "Name:",
        name
    );

    console.log(
        "Birthdate:",
        birthdate
    );

    console.log(
        "Age:",
        ageField.value
    );

    console.log(
        "Sex:",
        sex
    );

    console.log(
        "Nationality:",
        nationality
    );

    console.log(
        "Address:",
        address
    );

    console.log(
        "ID Number:",
        idNumber
    );

    console.log(
        "ID Type:",
        idType
    );


}

// =========================================================
// FIND BIRTHDATE
// =========================================================

function findBirthdate(text) {


    const patterns = [

        /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/,

        /\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/,

        /\b\d{1,2}\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+\d{4}\b/i,

        /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+\d{1,2},?\s+\d{4}\b/i

    ];


    for (const pattern of patterns) {

        const match =
            text.match(pattern);


        if (match) {

            return normalizeDate(
                match[0]
            );

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


    /*
    |--------------------------------------------------------------------------
    | YYYY/MM/DD
    |--------------------------------------------------------------------------
    */

    let match =
        value.match(
            /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/
        );


    if (match) {

        return `${match[2].padStart(2, "0")} /${match[3].padStart(2, "0")}/${match[1]} `;

    }


    /*
    |--------------------------------------------------------------------------
    | MM/DD/YYYY
    |--------------------------------------------------------------------------
    */

    match =
        value.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
        );


    if (match) {

        return `${match[1].padStart(2, "0")} /${match[2].padStart(2, "0")}/${match[3]} `;

    }


    return value;


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


    if (
        /\bSEX\s*[:\-]?\s*(FEMALE|F)\b/.test(
            upper
        )
    ) {

        return "Female";

    }


    if (
        /\bSEX\s*[:\-]?\s*(MALE|M)\b/.test(
            upper
        )
    ) {

        return "Male";

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

        return cleanField(
            match[1]
        );

    }


    if (
        upper.includes("FILIPINO")
    ) {

        return "Filipino";

    }


    if (
        upper.includes("PHILIPPINE")
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

        /\b(?:ID\s*(?:NO|NUMBER)|IDENTIFICATION\s*(?:NO|NUMBER))\s*[:#\-]?\s*([A-Z0-9\-]{5,30})\b/i,

        /\b[A-Z]{1,4}\-\d{4,15}\b/,

        /\b\d{2}\-\d{5,15}\b/

    ];


    for (const pattern of patterns) {

        const match =
            text.match(pattern);


        if (!match) {
            continue;
        }


        if (match[1]) {

            return match[1].trim();

        }


        return match[0].trim();

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

            return formatIDType(
                type
            );

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


    /*
    |--------------------------------------------------------------------------
    | Look for labeled name
    |--------------------------------------------------------------------------
    */

    for (let i = 0; i < lines.length; i++) {

        const line =
            lines[i];


        const match =
            line.match(
                /^(?:NAME|FULL NAME)\s*[:\-]?\s*(.+)$/i
            );


        if (match) {

            const candidate =
                cleanName(
                    match[1]
                );


            if (isPossibleName(candidate)) {

                return candidate;

            }


            if (
                lines[i + 1] &&
                isPossibleName(lines[i + 1])
            ) {

                return cleanName(
                    lines[i + 1]
                );

            }
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Look for common Philippine ID name format:
    |
    | LAST NAME
    | FIRST NAME
    | MIDDLE NAME
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | Avoid random OCR lines
    |--------------------------------------------------------------------------
    */

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
            upper.includes("IDENTIFICATION")
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
// NAME CLEANER
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


    /*
    |--------------------------------------------------------------------------
    | Look for ADDRESS label
    |--------------------------------------------------------------------------
    */

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


        /*
        |--------------------------------------------------------------------------
        | If address continues on following lines,
        | collect them.
        |--------------------------------------------------------------------------
        */

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
                upper.includes("ID NO")
            ) {

                break;

            }


            if (isPossibleAddressLine(next)) {

                address =
                    address
                        ? `${address}, ${next} `
                        : next;

            }

        }


        if (address) {

            return address;

        }
    }


    /*
    |--------------------------------------------------------------------------
    | Fallback: look for typical address indicators
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | Reset previews
    |--------------------------------------------------------------------------
    */

    frontPreview.innerHTML = `

        < span class="text-xs text-slate-400" >
            No image
    </ >

        `;


    backPreview.innerHTML = `

        < span class="text-xs text-slate-400" >
            No image
    </ >

        `;


    /*
    |--------------------------------------------------------------------------
    | Reset badges
    |--------------------------------------------------------------------------
    */

    frontCapturedBadge.classList.add(
        "hidden"
    );


    backCapturedBadge.classList.add(
        "hidden"
    );


    /*
    |--------------------------------------------------------------------------
    | Reset front status
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | Reset back status
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | Reset complete
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | Reset capture button
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | Reset instructions
    |--------------------------------------------------------------------------
    */

    scanStatus.textContent =
        "Ready to capture front";


    cameraInstruction.textContent =
        "Position the front of the ID inside the frame.";


    /*
    |--------------------------------------------------------------------------
    | Reset OCR status
    |--------------------------------------------------------------------------
    */

    setOCRStatus(
        "Waiting",
        "waiting"
    );


    /*
    |--------------------------------------------------------------------------
    | Hide retake
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | Clear form
    |--------------------------------------------------------------------------
    */

    nameField.value = "";
    birthdateField.value = "";
    ageField.value = "";
    sexField.value = "";
    nationalityField.value = "";
    addressField.value = "";
    idNumberField.value = "";
    idTypeField.value = "";


    /*
    |--------------------------------------------------------------------------
    | Restart camera
    |--------------------------------------------------------------------------
    */

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

confirmButton.addEventListener(
    "click",
    function () {


        alert(
            "Google Sheets saving will be connected later."
        );

    }


);

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
