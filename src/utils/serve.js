import { image2text } from "./ocr.js";
import { createPDF } from "./pdf.js";
import { translate } from "./translate.js";

export const process = async (buffer) => {
    try {
        const text = await image2text(buffer);
        console.log(text);
        const viText = await translate(text);
        console.log(viText);
        const pdfFile = createPDF(viText);
        console.log("This is PDF file: " + pdfFile)
    } catch (e) {
        console.log(e);
    }
};
