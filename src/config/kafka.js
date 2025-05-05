import { Kafka } from "kafkajs";

export const RECEIVED_TOPIC = 'received_files';
export const OUTPUT_TOPIC = 'ocr-results-topic';

const kafka_broker = process.env.KAFKA_BROKERS || "kafka:9092"

const kafka = new Kafka({
    clientId: 'upload-app-producer',
    brokers: ['kafka:9092']
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