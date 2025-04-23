const ocr = require("./ocr");
const { createPDF } = require("./pdf");
const { translate } = require("./translate");

(async () => {
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
})();
