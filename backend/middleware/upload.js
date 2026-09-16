const { createUploader } = require('../config/multer');

// Inquiries image uploader (10MB limit)
const upload = createUploader('inquiries', 'inquiry', 10);

module.exports = upload;
