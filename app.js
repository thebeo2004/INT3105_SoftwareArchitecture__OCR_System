import express from "express";
import {process} from "./src/utils/serve.js"
import { upload } from "./src/config/multer.js";

const app = express();

// Define middleware to handle form submitting
app.use(express.urlencoded({extended:true}));
app.use(upload.array("files"));


const PORT = 3000;

app.get('/process', async (req, res) => {
    try {
        await process();
        res.send('Successfully processing')
    } catch (error) {
        res.send(error.message)
    }
})

app.post('/upload', (req, res) => {
    if (!req.files) {
        return res.status(400).json({message: "No file was uploaded"})
    }
    console.log(req.files);
    res.send('Successfully uploading files');
})

app.listen(PORT, () => {
    console.log(`Server is listening at ${PORT} port`)
})