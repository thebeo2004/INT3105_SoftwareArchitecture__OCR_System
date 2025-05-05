FROM node:alpine

RUN apk update && apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    tesseract-ocr-data-vie \
    && rm -rf /var/cache/apk/*

WORKDIR /app

COPY package.json .
COPY package-lock.json .
# Just install dependencies necessary for production
RUN npm install --production

COPY src ./src
COPY font ./font

EXPOSE 5001

CMD ["node", "src/controller/worker.js"]