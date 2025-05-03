import { image2text } from "./ocr.js";
import { createPDF } from "./pdf.js";
import { translate } from "./translate.js";
import fs from "fs";
import path from "path";

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

export const process = async (buffer, outputDir) => {
    let text, viText, pdfFileName; // Khai báo pdfFileName ở đây

    // --- OCR Step ---
    const ocrEnd = ocrProcessingDurationSeconds.startTimer();
    try {
        text = await image2text(buffer);
        ocrEnd(); // End timer on success
        console.log(text);
    } catch (e) {
        ocrEnd(); // End timer on error
        ocrErrorsTotal.inc({ error_type: e.constructor.name });
        console.error("OCR Error:", e);
        throw new Error(`OCR failed: ${e.message}`);
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
        throw new Error(`Translation failed: ${e.message}`);
    }

    // --- PDF Creation Step ---
    const pdfEnd = pdfCreationDurationSeconds.startTimer();
    try {
        pdfFileName = `processed_${Date.now()}.pdf`; // Tạo tên file duy nhất
        const pdfFilePath = path.join(outputDir, pdfFileName); // Đường dẫn đầy đủ
        createPDF(viText, pdfFilePath); // Lưu file PDF vào thư mục output
        pdfEnd();
        console.log("PDF created: " + pdfFilePath);
    } catch (e) {
        pdfEnd();
        pdfCreationErrorsTotal.inc({ error_type: e.constructor.name });
        console.error("PDF Creation Error:", e);
        throw new Error(`PDF creation failed: ${e.message}`);
    }

    // Trả về tên file (không phải đường dẫn đầy đủ) để tải về
    return pdfFileName;
};
