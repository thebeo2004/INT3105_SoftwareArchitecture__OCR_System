import { recognize } from "node-tesseract-ocr"

async function image2text(path){
  return await recognize(path, {
    lang: "eng"
  })
}

export {
  image2text
}

