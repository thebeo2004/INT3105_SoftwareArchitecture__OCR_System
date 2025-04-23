import ocr from "./ocr";
import { createPDF } from "./pdf";
import { translate } from "./translate";

export const process = async () => {
    try {
        const text = await ocr.image2text("./data/sample.png");
        console.log(text);
        const viText = await translate(text);
        console.log(viText);
        const pdfFile = createPDF(viText);
        console.log("This is PDF file: " + pdfFile)
    } catch (e) {
        console.log(e);
    }
};
