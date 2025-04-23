import { recognize } from "node-tesseract-ocr"

async function image2text(buffer){
  return await recognize(buffer, {
    lang: "eng"
  })
}

export {
  image2text
}

