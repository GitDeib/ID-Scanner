// =========================================================
// CONFIG
// =========================================================
const GOOGLE_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbw4Tpot9Czz5WLj17JQeFgArnHk0CsmKTZtao8RX4I-OXjP6eP7SXND6SWSV2Cg2Gyr/exec";

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

// Locator banner — always shown once a scan has been read, telling the
// operator whether this person is already on record ("Present") or
// looks new ("New"). Purely informational: it never blocks Confirm.
const duplicateWarning = document.getElementById("duplicateWarning");

// Only Name, District, and Birthdate are collected — the sheet has no
// columns for sex, address, or ID number, so there's no use asking
// for or displaying them.
const fields = {
    name: document.getElementById("name"),
    district: document.getElementById("district"),
    birthdate: document.getElementById("birthdate"),
};

// =========================================================
// STATE
// =========================================================
let cameraStream = null;
let scannedIdImage = null;

// Identifies the scan currently being worked on. Every confirm attempt
// for the same scan sends the same id, so if a save completes on the
// server but the response is lost on the way back, tapping Confirm
// again is recognised as a retry instead of adding a second "New" row.
// A new id is minted only when a new scan starts.
let clientRequestId = null;

function newRequestId() {
    return (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2));
}

// =========================================================
// SCREENS
// =========================================================
function showScreen(name) {
    [captureScreen, processingScreen, reviewScreen].forEach(s => s.classList.remove("active"));
    ({ capture: captureScreen, processing: processingScreen, review: reviewScreen }[name])?.classList.add("active");
}

// =========================================================
// SERVER
// =========================================================
// Single place every request goes through. Note it does NOT use
// mode: "no-cors". With no-cors the response is opaque — the app
// can't tell a completed save from a rejected one, so it reported
// "Successfully saved!" on server errors and "Failed to save" whenever
// the connection dropped while the server was still writing.
async function postToServer(payload) {
    const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
    });

    const raw = await res.text();
    try {
        return JSON.parse(raw);
    } catch {
        console.error("Non-JSON response from Apps Script:", raw);
        throw new Error("The server did not return valid JSON. See the console for the raw response.");
    }
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
// The captured frame is compressed and kept in memory only long
// enough to run OCR and show the operator a preview — it is never
// uploaded anywhere for storage.
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
// LOCATOR STATUS (UI)
// =========================================================
// `match` mirrors what the backend's findSimilarRecord() returns:
// { no, name, birthday, type: "birthday_and_name" | "similar_name" }
// or null. Always shown once a scan has been read, so the operator
// knows right away whether this is a known person ("Present") or a
// new one ("New") — before they even tap Confirm.
function showDuplicateWarning(match) {
    if (!duplicateWarning) return;

    duplicateWarning.classList.remove("hidden");
    duplicateWarning.classList.remove(
        "border-amber-200", "bg-amber-50", "text-amber-800",
        "border-blue-200", "bg-blue-50", "text-blue-800"
    );

    if (match) {
        duplicateWarning.classList.add("border-amber-200", "bg-amber-50", "text-amber-800");
        duplicateWarning.textContent =
            `Present — already on the list as No. ${match.no} (${match.name}). ` +
            `Confirming will mark them Present, not add a new row.`;
    } else {
        duplicateWarning.classList.add("border-blue-200", "bg-blue-50", "text-blue-800");
        duplicateWarning.textContent =
            "New — no matching entry was found. Confirming will add this as a new row.";
    }
}

function hideDuplicateWarning() {
    if (!duplicateWarning) return;
    duplicateWarning.classList.add("hidden");
    duplicateWarning.textContent = "";
}

// =========================================================
// CAPTURE -> EXTRACT
// =========================================================
async function captureImage() {
    if (!cameraStream) return alert("Camera is not active.");
    if (!camera.videoWidth || !camera.videoHeight) return alert("Camera is not ready yet.");

    captureCanvas.width = camera.videoWidth;
    captureCanvas.height = camera.videoHeight;
    captureCanvas.getContext("2d").drawImage(camera, 0, 0, captureCanvas.width, captureCanvas.height);

    scannedIdImage = compressImage(captureCanvas, 800, 0.6);
    clientRequestId = newRequestId(); // new scan, new retry-safety id
    showScannedIdPreview(scannedIdImage);
    scannedIdCapturedBadge.classList.remove("hidden");
    stopCamera();

    processingText.textContent = "Reading the ID...";
    showScreen("processing");
    setOCRStatus("Extracting...", "loading");
    hideDuplicateWarning();

    try {
        // Extract + locate only — nothing is written to the sheet yet.
        const { data: extracted, match } = await extractIdData(scannedIdImage);
        const filledCount = applyExtractedData(extracted);
        showDuplicateWarning(match);

        // Don't claim success over a blank form. If the OCR call
        // returned but nothing landed in any field, the operator needs
        // to know to type the details in.
        if (filledCount === 0) {
            setOCRStatus("No data found", "error");
            scanStatus.textContent = "ID captured — please enter the details manually";
        } else {
            setOCRStatus(`Extracted (${filledCount})`, "success");
            scanStatus.textContent = "ID captured — review before confirming";
        }
    } catch (error) {
        console.error("Extraction error:", error);
        setOCRStatus("Extraction failed", "error");
        alert("Could not read the ID automatically.\n\n" + (error.message || "") +
            "\n\nPlease fill in the details manually, then tap Confirm.");
        scanStatus.textContent = "ID captured — review the information";
    }

    updateCompleteStep();
    showScreen("review");
}

// =========================================================
// STRUCTOCR EXTRACTION (extract + locate only, no save)
// =========================================================
async function extractIdData(image) {
    const result = await postToServer({ action: "extract", scannedIdImage: image });
    if (!result.success) throw new Error(result.message || "Extraction failed.");
    // `match` is the locator lookup the backend runs right after OCR —
    // null when nothing in the sheet looks like the same person.
    return { data: result.data, match: result.match || null };
}

// Returns how many fields were actually populated, so the caller can
// tell "read successfully" apart from "returned an empty result".
function applyExtractedData(data) {
    if (!data) return 0;
    let filled = 0;

    if (data.name) {
        // The sheet lists people as "Family Name, First Name MI" but
        // StructOCR reads a national ID as "Given Names Surname" — flip
        // it here so the field already matches the sheet's convention
        // and the operator doesn't have to retype it every scan.
        fields.name.value = (data.givenName && data.surname)
            ? `${data.surname}, ${data.givenName}`
            : data.name;
        filled++;
    }
    if (data.birthdate) {
        fields.birthdate.value = toMMDDYYYY(data.birthdate);
        filled++;
    }

    return filled;
}

function toMMDDYYYY(isoDate) {
    const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[2]}/${m[3]}/${m[1]}` : isoDate;
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
    clientRequestId = null;
    scannedIdPreview.innerHTML = `<span class="text-xs text-slate-400">No image</span>`;
    scannedIdCapturedBadge.classList.add("hidden");
    resetCompleteStep();
    captureButton.disabled = false;
    captureButtonText.textContent = "Capture ID";
    scanStatus.textContent = "Ready to capture ID";
    cameraInstruction.textContent = "Position the ID inside the frame.";
    setOCRStatus("Waiting", "waiting");
    hideDuplicateWarning();

    showScreen("capture");
    startCamera();
}

function clearForm() {
    Object.values(fields).forEach(f => (f.value = ""));
}

// =========================================================
// SAVE
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
        district: fields.district.value.trim(),
        birthdate: fields.birthdate.value.trim(),

        // Same id on every retry of this scan, so the server can
        // recognise a repeat instead of adding a second "New" row.
        clientRequestId,
    };

    const result = await postToServer(payload);
    if (!result.success) {
        throw new Error(result.message || "The server rejected the record.");
    }
    return result;
}

// Manual confirm via the Confirm button.
async function submitToGoogleSheet() {
    const firstInvalid = validateFields();

    if (firstInvalid) {
        return firstInvalid.focus();
    }

    if (!scannedIdImage) {
        return alert(
            "No ID has been scanned yet. Please capture the ID first."
        );
    }

    if (!clientRequestId) clientRequestId = newRequestId();

    confirmButton.disabled = true;
    const originalText = confirmButton.textContent;
    confirmButton.textContent = "Checking...";

    try {
        const result = await saveRecord();

        if (result.duplicate) {
            alert("This scan was already processed earlier.\n\nNo changes were made.");
        } else if (result.matchStatus === "Present") {
            alert(
                "Present — this person is already on the list (No. " + result.no + ").\n\n" +
                (result.birthdayFilled ? "Their birthday was filled in since it was blank." : "No changes were needed.")
            );
        } else {
            alert("New — added to the list as No. " + result.no + ".");
        }
        retakeScan();

    } catch (error) {
        console.error("Save error:", error);

        // A thrown fetch (as opposed to a server-reported failure)
        // means the connection dropped — which may well have happened
        // *after* the server finished writing. Say so plainly, and
        // make clear that retrying is safe, since the request id
        // stops a second row being added.
        const looksLikeNetworkError = error instanceof TypeError ||
            /network|failed to fetch|load failed/i.test(error.message || "");

        if (looksLikeNetworkError) {
            alert(
                "The connection dropped before the server replied.\n\n" +
                "The check may already have gone through. Tap Confirm again — " +
                "if it went through the first time, no duplicate will be created."
            );
        } else {
            alert("Failed to save the record.\n\n" + (error.message || "Please try again."));
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
    startCamera();
});
window.addEventListener("beforeunload", stopCamera);