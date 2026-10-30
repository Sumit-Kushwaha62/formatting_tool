const path = require('path');

const normalizeFiles = (files) => {
  if (!files) return [];
  return Array.isArray(files) ? files : [files];
};

const findInvalidUpload = (files, allowedExtensions) => {
  const allowed = new Set(allowedExtensions.map((extension) => extension.toLowerCase()));
  return normalizeFiles(files).find((file) => {
    const extension = path.extname(file?.originalname || '').toLowerCase();
    return !allowed.has(extension);
  }) || null;
};

const hasMinimumFiles = (files, minimum) => normalizeFiles(files).length >= minimum;

module.exports = { findInvalidUpload, hasMinimumFiles, normalizeFiles };
