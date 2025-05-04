import { Kafka } from "kafkajs";

const RECEIVED_TOPIC = 'received_files';
const OUTPUT_TOPIC = 'ocr-results-topic';

export const kafka = new Kafka({
    clientId: 'upload-app-producer',
    brokers: ['localhost:9092']
});

export const sending_msg =  async (msgPayload, producer) => {
    await producer.send({
        topic: RECEIVED_TOPIC,
        messages: [
            {value: JSON.stringify(msgPayload)}
        ]
    })

    console.log(`Message sent to Kafka topic ${RECEIVED_TOPIC}`)
}