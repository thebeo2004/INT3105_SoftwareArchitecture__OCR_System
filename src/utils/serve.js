import { image2text } from "./ocr.js";
import { createPDF } from "./pdf.js";
import { translate } from "./translate.js";
import fs from 'fs/promises';

// Import the necessary metrics
import {
    ocrProcessingDurationSeconds,
    pdfCreationDurationSeconds,
    translationDurationSeconds,
    ocrErrorsTotal,
    pdfCreationErrorsTotal,
    translationErrorsTotal,
    totalProcessingDurationSeconds
} from "../middlewares/measurement.js";

export const process = async (filePath) => {
    let text, viText, pdfFile;
    let buffer;

    try {
        buffer = await fs.readFile(filePath); 
    } catch (readError) {
        console.error(`Error reading file ${filePath}:`, readError);
        throw new Error(`Failed to read file: ${readError.message}`);
    }

    const totalProcessTimer = totalProcessingDurationSeconds.startTimer();

    // --- OCR Step ---
    const ocrEnd = ocrProcessingDurationSeconds.startTimer();
    try {
        text = await image2text(buffer);
        ocrEnd(); // End timer on success
        console.log(text);
    } catch (e) {
        ocrEnd(); // Still end timer on error
        ocrErrorsTotal.inc({ error_type: e.constructor.name }); // Increment error counter
        console.error("OCR Error:", e);
        totalProcessTimer(); // Stop total timer on error
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
        totalProcessTimer(); // Stop total timer on error
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
        pdfFile = await createPDF(viText); // Use translated text and await the promise
        pdfEnd();
        totalProcessTimer(); 
        console.log("PDF created: " + pdfFile);
        return pdfFile; // Return the PDF file path on success
    } catch (e) {
        pdfEnd();
        pdfCreationErrorsTotal.inc({ error_type: e.constructor.name });
        totalProcessTimer(); // Stop total timer on error
        console.error("PDF Creation Error:", e);
        throw new Error(`PDF creation failed: ${e.message}`);
    }

    // Stop total timer on error
    // If all steps succeed, the overall process for this file is successful
    // (filesProcessedTotal is incremented in the worker after this function returns successfully)
    // Remove the implicit undefined return
};
