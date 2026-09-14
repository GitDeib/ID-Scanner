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

        // Stop previous camera if one exists
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
        < div class="text-center px-6" >

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

function captureImage() {


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
    | Capture the full camera frame
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
    | Convert image to JPEG
    |--------------------------------------------------------------------------
    */

    const imageData = captureCanvas.toDataURL(
        "image/jpeg",
        0.90
    );


    /*
    |--------------------------------------------------------------------------
    | Save according to current side
    |--------------------------------------------------------------------------
    */

    if (currentSide === "front") {

        frontImage = imageData;

        showFrontPreview(imageData);

        updateFrontCaptured();


        /*
        |--------------------------------------------------------------------------
        | Move to BACK
        |--------------------------------------------------------------------------
        */

        currentSide = "back";

        updateBackStep();

        scanStatus.textContent = "Front captured — ready to capture back";

        cameraInstruction.textContent =
            "Turn the ID over and position the back inside the frame.";

        captureButtonText.textContent = "Capture Back";


    } else {

        backImage = imageData;

        showBackPreview(imageData);

        updateBackCaptured();


        /*
        |--------------------------------------------------------------------------
        | Finished
        |--------------------------------------------------------------------------
        */

        currentSide = "finished";

        updateCompleteStep();

        scanStatus.textContent =
            "Both sides captured — review the information";

        cameraInstruction.textContent =
            "Both sides have been captured.";

        captureButtonText.textContent = "Scan Complete";


        captureButton.disabled = true;

        captureButton.classList.remove(
            "bg-blue-600",
            "hover:bg-blue-700"
        );

        captureButton.classList.add(
            "bg-emerald-600",
            "cursor-not-allowed"
        );


        /*
        |--------------------------------------------------------------------------
        | Show Retake
        |--------------------------------------------------------------------------
        */

        retakeButton.classList.remove("hidden");
        retakeButton.classList.add("flex");


        /*
        |--------------------------------------------------------------------------
        | OCR status
        |--------------------------------------------------------------------------
        */

        ocrStatus.textContent = "Ready for OCR";

        ocrStatus.classList.remove(
            "bg-slate-100",
            "text-slate-500"
        );

        ocrStatus.classList.add(
            "bg-blue-50",
            "text-blue-600"
        );


        /*
        |--------------------------------------------------------------------------
        | Later:
        | runOCR(frontImage, backImage)
        |--------------------------------------------------------------------------
        */
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
// FRONT CAPTURED STATUS
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
// BACK STEP STATUS
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
// BACK CAPTURED STATUS
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
// RETAKE
// =========================================================

function retakeScan() {


    frontImage = null;
    backImage = null;

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

    frontCapturedBadge.classList.add("hidden");
    backCapturedBadge.classList.add("hidden");


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
    | Reset complete status
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
    | Reset button
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

    captureButtonText.textContent = "Capture Front";


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

    ocrStatus.textContent = "Waiting";

    ocrStatus.classList.remove(
        "bg-blue-50",
        "text-blue-600"
    );

    ocrStatus.classList.add(
        "bg-slate-100",
        "text-slate-500"
    );


    /*
    |--------------------------------------------------------------------------
    | Hide retake button
    |--------------------------------------------------------------------------
    */

    retakeButton.classList.add("hidden");
    retakeButton.classList.remove("flex");


}

// =========================================================
// CLEAR EVERYTHING
// =========================================================

function clearEverything() {


    retakeScan();


    /*
    |--------------------------------------------------------------------------
    | Clear form fields
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


        /*
        |--------------------------------------------------------------------------
        | OCR / Google Sheets will be connected here later.
        |--------------------------------------------------------------------------
        */

        alert(
            "Confirmation will be connected to OCR and Google Sheets later."
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
