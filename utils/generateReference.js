const generateReference = (type) => {
  const prefix = type.toUpperCase().substring(0, 3);
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}-${timestamp}-${random}`;
};

module.exports = generateReference;