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

app.post('/upload', async (req, res) => {
    try {

        if (!req.files) {
            return res.status(400).json({message: "No file was uploaded"})
        }
        
        console.log(`Received ${req.files.length} files.`)

        let data = [];

        for (const file of req.files) {
            data.push({
                originalName: file.originalName,
                savedName: file.filename,
                path: file.path,
                size: file.size
            })

            // Perform asynchronous operations fer file
            // await some AsyncFunction(file)
        }

        res.status(200).json({
            message: `Successfully uploaded and processed ${req.files.length} files.`,
            uploadedFilesData: data
        })

    } catch (err) {
        res.status(500).send(err.message);
    }
})

app.listen(PORT, () => {
    console.log(`Server is listening at ${PORT} port`)
})