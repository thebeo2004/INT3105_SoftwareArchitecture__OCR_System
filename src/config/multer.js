// src/config/multer.js

import multer from "multer";

// Lưu file trong bộ nhớ (buffer), không lưu vào disk
const storage = multer.memoryStorage();

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Giới hạn 5MB mỗi file
  }
});
