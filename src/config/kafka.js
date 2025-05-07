import { Kafka } from "kafkajs";
import crypto from 'crypto';

export const RECEIVED_TOPIC = 'received_files';
export const OUTPUT_TOPIC = 'ocr-results-topic';

const kafka_broker = process.env.KAFKA_BROKERS || "kafka:9092"

export const kafka = new Kafka({
    // Define unique clientId among multiple workers
    clientId: `ocr-worker-${crypto.randomBytes(4).toString('hex')}`,
    brokers: [kafka_broker]
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