import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { OUTPUT_DIR } from '../controller/worker';
import path from 'path';

function createPDF(text) {

    const filename = `${Date.now()}.pdf`
    const fullOutputPath = path.join(OUTPUT_DIR, filename)

    const doc = new PDFDocument();
    doc.pipe(createWriteStream(fullOutputPath));
    doc.font('font/Roboto-Regular.ttf')
        .fontSize(14)
        .text(text, 100, 100);
    doc.end();
    
    return fullOutputPath;
}

export {
    createPDF
}