import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';

const OUT_FILE = "./output/output.pdf";

function createPDF(text) {
    const doc = new PDFDocument();
    doc.pipe(createWriteStream(OUT_FILE));
    doc.font('font/Roboto-Regular.ttf')
        .fontSize(14)
        .text(text, 100, 100);
    doc.end();
    return OUT_FILE;
}

export {
    createPDF
}