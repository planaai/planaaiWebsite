const { createUploader } = require('../config/multer');

// Raid image uploader (10MB limit)
const uploadRaid = createUploader('raids', 'raid', 10);

module.exports = uploadRaid;
