import multer from "multer";
import { fileFilter } from "../middlewares/file_filter.js";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/')
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname)
    }
})

export const upload = multer({
    storage:storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 4 * 1024 * 1024
    }
})