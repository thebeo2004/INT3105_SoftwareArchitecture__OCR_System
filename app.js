import express from "express";
import {process} from "./utils/serve.js"

const app = express();

const PORT = 3000;

app.get('/process', async (req, res) => {
    try {
        await process();
        res.send('Successfully processing')
    } catch (error) {
        res.send(error.message)
    }
})

app.listen(PORT, () => {
    console.log(`Server is listening at ${PORT} port`)
})