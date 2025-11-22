const Transaction = require('../models/Transaction');
const Stock = require('../models/Stock');
const Product = require('../models/Product');
const moment = require('moment');

/**
 * Simple Linear Regression for demand forecasting
 * @param {Array} dataPoints - Array of {x: dayNumber, y: quantity}
 * @returns {Object} - {slope, intercept, rSquared}
 */
function linearRegression(dataPoints) {
  if (dataPoints.length < 2) {
    return { slope: 0, intercept: 0, rSquared: 0 };
  }

  const n = dataPoints.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;

  dataPoints.forEach(point => {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
    sumYY += point.y * point.y;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  let ssRes = 0, ssTot = 0;
  const meanY = sumY / n;
  dataPoints.forEach(point => {
    const predicted = slope * point.x + intercept;
    ssRes += Math.pow(point.y - predicted, 2);
    ssTot += Math.pow(point.y - meanY, 2);
  });
  const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

  return { slope, intercept, rSquared };
}

/**
 * Calculate daily demand rate from historical transactions
 * @param {Array} transactions - Historical delivery transactions
 * @returns {Number} - Average daily demand
 */
function calculateDailyDemand(transactions) {
  if (!transactions || transactions.length === 0) {
    return 0;
  }

  // Get transactions from last 60 days
  const sixtyDaysAgo = moment().subtract(60, 'days').toDate();
  const recentTransactions = transactions.filter(t => 
    t.completedAt && new Date(t.completedAt) >= sixtyDaysAgo
  );

  if (recentTransactions.length === 0) {
    return 0;
  }

  // Calculate total quantity delivered
  let totalQuantity = 0;
  recentTransactions.forEach(transaction => {
    transaction.items.forEach(item => {
      totalQuantity += item.quantity;
    });
  });

  // Calculate days in period
  const oldestDate = moment.min(recentTransactions.map(t => moment(t.completedAt)));
  const daysInPeriod = moment().diff(oldestDate, 'days') || 1;

  return totalQuantity / daysInPeriod;
}

/**
 * Forecast stock shortage and reorder recommendations
 * @param {Object} stock - Stock document with populated product
 * @returns {Object} - Forecast data
 */
async function forecastDemand(stock) {
  try {
    const productId = stock.product._id || stock.product;
    const warehouseId = stock.warehouse._id || stock.warehouse;
    const currentQuantity = stock.quantity;
    const minStockLevel = stock.product.minStockLevel || 0;
    const maxStockLevel = stock.product.maxStockLevel || minStockLevel * 2;

    // Get all completed delivery transactions for this warehouse
    const allDeliveryTransactions = await Transaction.find({
      type: 'delivery',
      status: 'completed',
      fromWarehouse: warehouseId,
      completedAt: { $exists: true }
    })
    .populate('items.product')
    .sort({ completedAt: 1 })
    .limit(200);

    // Filter transactions that contain this product
    const deliveryTransactions = allDeliveryTransactions.filter(transaction => {
      return transaction.items.some(item => {
        const itemProductId = item.product?._id?.toString() || item.product?.toString();
        return itemProductId === productId.toString();
      });
    });

    // If no historical data, check if stock is low
    if (deliveryTransactions.length === 0) {
      if (currentQuantity <= minStockLevel) {
        return {
          productId: productId.toString(),
          productName: stock.product.name,
          sku: stock.product.sku,
          currentStock: currentQuantity,
          minStockLevel,
          willRunOut: true,
          daysUntilShortage: 0,
          suggestedReorderQuantity: maxStockLevel - currentQuantity || minStockLevel * 2,
          confidence: 'low',
          reason: 'No historical data available',
          dailyDemand: 0
        };
      }
      // Even if not low, show forecast if stock is below 2x min level
      if (currentQuantity <= minStockLevel * 2) {
        return {
          productId: productId.toString(),
          productName: stock.product.name,
          sku: stock.product.sku,
          currentStock: currentQuantity,
          minStockLevel,
          willRunOut: false,
          daysUntilShortage: 999,
          daysUntilMinLevel: 999,
          suggestedReorderQuantity: minStockLevel * 2,
          confidence: 'low',
          reason: 'No historical data - monitoring stock levels',
          dailyDemand: 0
        };
      }
      return null;
    }

    // Calculate daily demand rate
    const dailyDemand = calculateDailyDemand(deliveryTransactions);

    // If no demand detected, check if already low
    if (dailyDemand === 0) {
      if (currentQuantity <= minStockLevel) {
        return {
          productId: productId.toString(),
          productName: stock.product.name,
          sku: stock.product.sku,
          currentStock: currentQuantity,
          minStockLevel,
          willRunOut: true,
          daysUntilShortage: 0,
          suggestedReorderQuantity: maxStockLevel - currentQuantity || minStockLevel * 2,
          confidence: 'low',
          reason: 'No recent demand detected',
          dailyDemand: 0
        };
      }
      // Show forecast even with no demand if stock is low
      if (currentQuantity <= minStockLevel * 1.5) {
        return {
          productId: productId.toString(),
          productName: stock.product.name,
          sku: stock.product.sku,
          currentStock: currentQuantity,
          minStockLevel,
          willRunOut: false,
          daysUntilShortage: 999,
          daysUntilMinLevel: 999,
          suggestedReorderQuantity: minStockLevel * 2,
          confidence: 'low',
          reason: 'No recent demand - stock monitoring',
          dailyDemand: 0
        };
      }
      return null;
    }

    // Calculate days until stock runs out
    const daysUntilShortage = Math.ceil(currentQuantity / dailyDemand);
    const daysUntilMinLevel = Math.ceil((currentQuantity - minStockLevel) / dailyDemand);

    // Determine if reorder is needed - make conditions less strict
    const willRunOut = daysUntilShortage <= 45; // Alert if will run out in 45 days (was 30)
    const needsReorder = daysUntilMinLevel <= 21; // Suggest reorder if will hit min level in 21 days (was 14)

    // Show forecast even if not urgent, but prioritize urgent ones
    if (!willRunOut && !needsReorder && daysUntilShortage > 60) {
      return null; // Only hide if stock will last more than 60 days
    }

    // Calculate suggested reorder quantity
    const daysToCover = 30;
    const safetyBuffer = minStockLevel;
    const suggestedReorderQuantity = Math.ceil((dailyDemand * daysToCover) + safetyBuffer - currentQuantity);

    // Determine confidence level
    let confidence = 'medium';
    if (deliveryTransactions.length >= 20) {
      confidence = 'high';
    } else if (deliveryTransactions.length < 5) {
      confidence = 'low';
    }

    return {
      productId: productId.toString(),
      productName: stock.product.name,
      sku: stock.product.sku,
      currentStock: currentQuantity,
      minStockLevel,
      dailyDemand: Math.round(dailyDemand * 100) / 100,
      willRunOut,
      daysUntilShortage: Math.max(0, daysUntilShortage),
      daysUntilMinLevel: Math.max(0, daysUntilMinLevel),
      suggestedReorderQuantity: Math.max(suggestedReorderQuantity, minStockLevel),
      confidence,
      reason: `Based on ${deliveryTransactions.length} historical transactions`
    };
  } catch (error) {
    console.error('Error in forecastDemand:', error);
    return null;
  }
}

/**
 * Get forecasts for all products
 * @returns {Array} - Array of forecast objects
 */
async function getAllForecasts() {
  try {
    const stocks = await Stock.find()
      .populate({
        path: 'product',
        select: 'name sku minStockLevel maxStockLevel unitOfMeasure isActive',
        match: { isActive: { $ne: false } } // Only get active products
      })
      .populate('warehouse', 'name code');

    const forecasts = [];
    
    for (const stock of stocks) {
      // Skip if product is null (was filtered out by match) or not active
      if (!stock.product || stock.product.isActive === false) {
        continue;
      }
      
      try {
        const forecast = await forecastDemand(stock);
        if (forecast) {
          forecasts.push({
            ...forecast,
            warehouseName: stock.warehouse?.name || 'Unknown',
            warehouseCode: stock.warehouse?.code || '',
            unitOfMeasure: stock.product.unitOfMeasure || 'units'
          });
        }
      } catch (error) {
        console.error(`Error forecasting for product ${stock.product?.name}:`, error);
        // Continue with other products
      }
    }

    // Sort by days until shortage (most urgent first), then by current stock
    forecasts.sort((a, b) => {
      if (a.daysUntilShortage !== b.daysUntilShortage) {
        return a.daysUntilShortage - b.daysUntilShortage;
      }
      return a.currentStock - b.currentStock;
    });

    return forecasts;
  } catch (error) {
    console.error('Error in getAllForecasts:', error);
    return [];
  }
}

module.exports = {
  forecastDemand,
  getAllForecasts,
  linearRegression,
  calculateDailyDemand
};
