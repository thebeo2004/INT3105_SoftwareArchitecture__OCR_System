import { image2text } from "./ocr.js";
import { createPDF } from "./pdf.js";
import { translate } from "./translate.js";
import crypto from 'crypto'

// Import the necessary metrics
import {
    ocrProcessingDurationSeconds,
    pdfCreationDurationSeconds,
    translationDurationSeconds,
    ocrErrorsTotal,
    pdfCreationErrorsTotal,
    translationErrorsTotal,
    cacheHitTotal,
    cacheMissTotal,
    totalProcessingDurationSeconds
} from "../middlewares/measurement.js";

export const process = async (fileBuffer, redisClient) => {
    
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const processedTextCacheKey = `ocrtrans:${fileHash}`;
    const PROCESSED_TEXT_CACHE_TTL = 60; // Time to Live = 1 minutes

    let ocrText;
    let translatedText;
    let outputPdfFilename;

    // Start timer for total processing time
    const totalProcessTimer = totalProcessingDurationSeconds.startTimer();

    try {
        // Check if there are any content with the same key as processedTextCacheKey in Redis
        const cachedProcessedText = await redisClient.get(processedTextCacheKey);

        if (cachedProcessedText) {
            translatedText = cachedProcessedText;
            cacheHitTotal.inc();
            console.log(`[CACHE SERVE] OCR+TRANSLATED Text Cache HIT for hash: ${fileHash}`);
        } else {
            cacheMissTotal.inc();
            console.log(`[CACHE SERVE] OCR+TRANSLATED Text Cache MISS for hash: ${fileHash}. Starting OCR and Translation.`);

            const ocrTimer = ocrProcessingDurationSeconds.startTimer();
            try {
                ocrText = await image2text(fileBuffer);
                ocrTimer();
                console.log(`[SERVE] OCR Text (hash: ${fileHash}):`, ocrText ? ocrText.substring(0, 100) + "..." : "EMPTY");
            } catch (e) {
                ocrTimer();
                ocrErrorsTotal.inc({ error_type: e.constructor.name });
                console.error(`[SERVE] OCR Error (hash: ${fileHash}):`, e);
                totalProcessTimer(); // Stop total timer on error
                throw new Error(`OCR failed: ${e.message}`);
            }

            if (!ocrText || ocrText.trim() === "") {
                console.warn(`[SERVE] Skipping translation for hash ${fileHash} due to empty OCR text.`);
                translatedText = "";
            } else {
                const translateTimer = translationDurationSeconds.startTimer();
                try {
                    translatedText = await translate(ocrText);
                    translateTimer();
                } catch (e) {
                    translateTimer();
                    translationErrorsTotal.inc({ error_type: e.constructor.name });
                    console.error(`[SERVE] Translation Error (hash: ${fileHash}):`, e);
                    totalProcessTimer(); // Stop total timer on error
                    throw new Error(`Translation failed: ${e.message}`);
                }
            }
            console.log(`[SERVE] Translated Text (hash: ${fileHash}):`, translatedText ? translatedText.substring(0, 100) + "..." : "EMPTY");

            if (translatedText && translatedText.trim() !== "") {
                await redisClient.set(processedTextCacheKey, translatedText, { EX: PROCESSED_TEXT_CACHE_TTL });
                console.log(`[CACHE SERVE] OCR+TRANSLATED Text stored in cache for hash: ${fileHash}`);
            } else {
                console.warn(`[SERVE] Translated text for hash ${fileHash} is empty. Not caching.`);
            }
        }

        const pdfTimer = pdfCreationDurationSeconds.startTimer();
        try {
            outputPdfFilename = await createPDF(translatedText || "No content to display.");
            pdfTimer();
        } catch (e) {
            pdfTimer();
            pdfCreationErrorsTotal.inc({ error_type: e.constructor.name });
            console.error(`[SERVE] PDF Creation Error (hash: ${fileHash}):`, e);
            totalProcessTimer(); // Stop total timer on error
            throw new Error(`PDF creation failed: ${e.message}`);
        }

        totalProcessTimer(); // Stop total timer after successful completion of all steps
        return outputPdfFilename;

    } catch (error) {
        console.error(`[SERVE] Error in processing pipeline for hash ${fileHash}:`, error.message);
        throw error;
    }
};
