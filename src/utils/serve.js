import { image2text } from "./ocr.js";
import { createPDF } from "./pdf.js";
import { translate } from "./translate.js";

// Import the necessary metrics
import {
    ocrProcessingDurationSeconds,
    pdfCreationDurationSeconds,
    translationDurationSeconds,
    ocrErrorsTotal,
    pdfCreationErrorsTotal,
    translationErrorsTotal,
    // ocrPagesProcessedTotal // Import if you can get page count from OCR result
} from "../middlewares/measurement.js";

export const process = async (buffer) => {
    let text, viText, pdfFile;

    // --- OCR Step ---
    const ocrEnd = ocrProcessingDurationSeconds.startTimer();
    try {
        text = await image2text(buffer);
        ocrEnd(); // End timer on success
        console.log(text);
        // Optional: Increment page count if available
        // const pageCount = ... // Get page count from OCR result if possible
        // if (pageCount) ocrPagesProcessedTotal.inc(pageCount);
    } catch (e) {
        ocrEnd(); // Still end timer on error
        ocrErrorsTotal.inc({ error_type: e.constructor.name }); // Increment error counter
        console.error("OCR Error:", e);
        throw new Error(`OCR failed: ${e.message}`); // Re-throw to stop processing this file
    }

    // --- Translation Step ---
    const translateEnd = translationDurationSeconds.startTimer();
    try {
        viText = await translate(text);
        translateEnd();
        console.log(viText);
    } catch (e) {
        translateEnd();
        translationErrorsTotal.inc({ error_type: e.constructor.name });
        console.error("Translation Error:", e);
        // Decide if you want to stop processing or continue with original text
        // Option 1: Stop processing
        throw new Error(`Translation failed: ${e.message}`);
        // Option 2: Continue with original text (remove throw, maybe assign text to viText)
        // viText = text; 
    }

    // --- PDF Creation Step ---
    const pdfEnd = pdfCreationDurationSeconds.startTimer();
    try {
        pdfFile = createPDF(viText); // Use translated text
        pdfEnd();
        console.log("PDF created: " + pdfFile);
    } catch (e) {
        pdfEnd();
        pdfCreationErrorsTotal.inc({ error_type: e.constructor.name });
        console.error("PDF Creation Error:", e);
        throw new Error(`PDF creation failed: ${e.message}`);
    }

    // If all steps succeed, the overall process for this file is successful
    // (filesProcessedTotal is incremented in app.js after this function returns successfully)
};
