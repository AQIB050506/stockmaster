const Tesseract = require('tesseract.js');

/**
 * Extract text from image using OCR
 * @param {Buffer|String} image - Image buffer or base64 string
 * @returns {Promise<String>} - Extracted text
 */
async function extractTextFromImage(image) {
  try {
    const { data: { text } } = await Tesseract.recognize(
      image,
      'eng',
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            // Progress logging can be added here
          }
        }
      }
    );
    return text;
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error('Failed to extract text from image');
  }
}

/**
 * Parse invoice/GRN text to extract products and quantities
 * @param {String} ocrText - Text extracted from OCR
 * @returns {Array} - Array of {productName, quantity, unitPrice}
 */
function parseDocumentText(ocrText) {
  const items = [];
  const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // Common patterns for invoices/GRNs
  const quantityPattern = /\b(\d+(?:\.\d+)?)\s*(?:pcs|units|kg|liters|boxes|meters|nos?|qty|quantity)\b/i;
  const numberPattern = /\b\d+(?:\.\d+)?\b/g;
  const pricePattern = /₹|rs|rupees?|price|amount|rate/i;

  let inItemsSection = false;
  let headerFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    const originalLine = lines[i];

    // Detect items section - look for common headers
    if (!headerFound && (
        line.includes('item') || 
        line.includes('product') || 
        line.includes('description') || 
        line.includes('particulars') || 
        line.includes('goods') ||
        line.includes('sr') ||
        line.includes('s.no') ||
        (line.includes('qty') && line.includes('rate'))
    )) {
      inItemsSection = true;
      headerFound = true;
      continue;
    }

    // Detect end of items section
    if (inItemsSection && (
        line.includes('total') || 
        line.includes('subtotal') || 
        line.includes('grand total') || 
        line.includes('tax') ||
        line.includes('gst') ||
        line.includes('amount payable') ||
        line.includes('net amount')
    )) {
      break;
    }

    if (inItemsSection) {
      // Try to extract product information
      const numbers = originalLine.match(numberPattern);
      if (numbers && numbers.length >= 1) {
        // Common invoice format: Product Name | Qty | Rate | Amount
        // Or: Product Name Qty Rate
        
        let quantity = 0;
        let unitPrice = 0;
        let productName = '';
        
        // Try different parsing strategies
        if (numbers.length >= 2) {
          // Usually: name quantity price
          quantity = parseFloat(numbers[0]);
          unitPrice = parseFloat(numbers[numbers.length - 1]);
          
          // Extract product name (text before first number)
          const nameMatch = originalLine.match(/^(.+?)(?:\s+\d)/);
          productName = nameMatch ? nameMatch[1].trim() : originalLine.split(/\d/)[0].trim();
        } else if (numbers.length === 1) {
          // Only one number - could be quantity
          quantity = parseFloat(numbers[0]);
          productName = originalLine.replace(/\d+(?:\.\d+)?/g, '').trim();
        }
        
        if (quantity > 0 && quantity < 100000 && productName.length > 2) {
          items.push({
            productName: productName.substring(0, 100),
            quantity: Math.round(quantity),
            unitPrice: unitPrice,
            rawLine: originalLine
          });
        }
      }
    }
  }

  // If no items found with pattern matching, try simpler approach
  if (items.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const numbers = line.match(/\d+(?:\.\d+)?/g);
      
      if (numbers && numbers.length >= 1) {
        const quantity = parseFloat(numbers[0]);
        if (quantity > 0 && quantity < 10000) {
          const productName = line.replace(/\d+(?:\.\d+)?/g, '').trim();
          if (productName.length > 2 && !productName.toLowerCase().includes('total')) {
            items.push({
              productName: productName.substring(0, 100),
              quantity: Math.round(quantity),
              unitPrice: numbers.length > 1 ? parseFloat(numbers[numbers.length - 1]) : 0,
              rawLine: line
            });
          }
        }
      }
    }
  }

  return items;
}

/**
 * Process image and extract structured data
 * @param {Buffer|String} image - Image buffer or base64
 * @returns {Promise<Object>} - {text, items, supplier, invoiceNumber}
 */
async function processDocument(image) {
  try {
    const ocrText = await extractTextFromImage(image);
    const items = parseDocumentText(ocrText);
    
    // Try to extract supplier name (usually at top)
    const lines = ocrText.split('\n').slice(0, 10);
    let supplier = '';
    for (const line of lines) {
      if (line.length > 5 && line.length < 50 && !line.match(/^\d/)) {
        supplier = line.trim();
        break;
      }
    }

    // Try to extract invoice/GRN number
    const invoiceMatch = ocrText.match(/(?:invoice|grn|challan|bill)\s*(?:no|number|#)?\s*:?\s*([A-Z0-9\-]+)/i);
    const invoiceNumber = invoiceMatch ? invoiceMatch[1] : '';

    return {
      text: ocrText,
      items,
      supplier: supplier || 'Unknown Supplier',
      invoiceNumber,
      extractedAt: new Date()
    };
  } catch (error) {
    console.error('Document processing error:', error);
    throw error;
  }
}

module.exports = {
  extractTextFromImage,
  parseDocumentText,
  processDocument
};
