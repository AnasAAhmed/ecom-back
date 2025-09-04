import { myCache } from "../app.js";
import { TryCatch } from "../middlewares/error.js";
import { Order } from "../models/order.js";
import { Product } from "../models/product.js";
import { User } from "../models/user.js";
import {
  calculatePercentage,
  getChartData,
  getCollections,
  getInventories,
} from "../utils/features.js";

export const getDashboardStats = TryCatch(async (req, res, next) => {
  let stats = {};
  const key = "admin-stats";

  if (myCache.has(key)) {
    stats = JSON.parse(myCache.get(key) as string);
  } else {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const productStatsPromise = Product.aggregate([
      {
        $facet: {
          count: [{ $count: "total" }],
          categories: [{ $group: { _id: "$category" } }],
          collections: [{ $group: { _id: "$collections" } }],
          lastSixMonths: [
            { $match: { createdAt: { $gte: sixMonthsAgo, $lte: today } } },
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const orderStatsPromise = Order.aggregate([
      {
        $facet: {
          allOrders: [
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$total" },
                count: { $sum: 1 },
              },
            },
          ],
          lastSixMonths: [
            { $match: { createdAt: { $gte: sixMonthsAgo, $lte: today } } },
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                },
                revenue: { $sum: "$total" },
                count: { $sum: 1 },
              },
            },
          ],
          latestTransaction: [
            { $sort: { createdAt: -1 } },
            { $limit: 4 },
            {
              $project: {
                _id: 1,
                discount: 1,
                total: 1,
                orderItemsCount: { $size: "$orderItems" },
                status: 1,
              },
            },
          ],
        },
      },
    ]);

    const userStatsPromise = User.aggregate([
      { $group: { _id: "$gender", count: { $sum: 1 } } },
    ]);

    const [productStatsRaw, orderStatsRaw, userStatsRaw] = await Promise.all([
      productStatsPromise,
      orderStatsPromise,
      userStatsPromise,
    ]);

    const productStats = productStatsRaw[0];
    const orderStats = orderStatsRaw[0];

    const productsCount = productStats.count[0]?.total || 0;
    const categories = productStats.categories.map((c: any) => c._id);
    const collections = productStats.collections.map((c: any) => c._id);

    const totalOrdersData =
      orderStats.allOrders[0] || { totalRevenue: 0, count: 0 };

    const latestTransaction = orderStats.latestTransaction.map((t: any) => ({
      _id: t._id,
      discount: t.discount,
      amount: t.total,
      quantity: t.orderItemsCount,
      status: t.status,
    }));

    const userStatsMap = { male: 0, female: 0 };
    userStatsRaw.forEach(({ _id, count }) => {
      if (_id === "male") userStatsMap.male = count;
      else if (_id === "female") userStatsMap.female = count;
    });

    const buildSixMonths = <T extends { [key:string]: { year: number; month: number } }>(
      raw: T[],
      valueKeys: (keyof T)[]
    ) => {
      const arr = new Array(6).fill(null).map(() => {
        const base: any = {};
        valueKeys.forEach((k) => (base[k] = 0));
        return base;
      });

      raw.forEach((item) => {
        const monthIdx =
          (today.getFullYear() - item._id.year) * 12 +
          (today.getMonth() - (item._id.month - 1));

        if (monthIdx >= 0 && monthIdx < 6) {
          arr[5 - monthIdx] = valueKeys.reduce(
            (acc, k) => ({ ...acc, [k]: item[k] }),
            {}
          );
        }
      });
      return arr;
    };

    const orderSixMonths = buildSixMonths(orderStats.lastSixMonths, [
      "revenue",
      "count",
    ]);
    const productSixMonths = buildSixMonths(productStats.lastSixMonths, [
      "count",
    ]);

    const thisMonthOrdersData = orderSixMonths[5] || {
      revenue: 0,
      count: 0,
    };
    const lastMonthOrdersData = orderSixMonths[4] || {
      revenue: 0,
      count: 0,
    };
    const thisMonthProductCount = productSixMonths[5]?.count || 0;
    const lastMonthProductCount = productSixMonths[4]?.count || 0;

    const changePercent = {
      revenue: calculatePercentage(
        thisMonthOrdersData.revenue,
        lastMonthOrdersData.revenue
      ),
      product: calculatePercentage(
        thisMonthProductCount,
        lastMonthProductCount
      ),
      user: 100, // Placeholder, add proper month-to-month user growth if needed
      order: calculatePercentage(
        thisMonthOrdersData.count,
        lastMonthOrdersData.count
      ),
    };

    // --- Counts ---
    const count = {
      revenue: totalOrdersData.totalRevenue,
      product: productsCount,
      user: userStatsMap.female + userStatsMap.male,
      order: totalOrdersData.count,
    };

    const categoryCount = await getInventories({ categories, productsCount });
    const collectionsCount = await getCollections({ collections });

    stats = {
      categoryCount,
      collectionsCount,
      changePercent,
      count,
      chart: {
        order: orderSixMonths.map((e) => e.count),
        revenue: orderSixMonths.map((e) => e.revenue),
      },
      userRatio: userStatsMap,
      latestTransaction,
    };

    myCache.set(key, JSON.stringify(stats));
  }

  return res.status(200).json({ success: true, stats });
});

export const getPieCharts = TryCatch(async (req, res, next) => {
  let charts;
  const key = "admin-pie-charts";

  if (myCache.has(key)) charts = JSON.parse(myCache.get(key) as string);
  else {
    const allOrderPromise = Order.find({}).select([
      "total",
      "discount",
      "subtotal",
      "tax",
      "shippingCharges",
    ]);

    const [
      processingOrder,
      shippedOrder,
      deliveredOrder,
      categories,
      productsCount,
      outOfStock,
      allOrders,
      allUsers,
      adminUsers,
      customerUsers,
    ] = await Promise.all([
      Order.countDocuments({ status: "Processing" }),
      Order.countDocuments({ status: "Shipped" }),
      Order.countDocuments({ status: "Delivered" }),
      Product.distinct("category"),
      Product.countDocuments(),
      Product.countDocuments({ stock: 0 }),
      allOrderPromise,
      User.find({}).select(["dob"]),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "user" }),
    ]);

    const orderFullfillment = {
      processing: processingOrder,
      shipped: shippedOrder,
      delivered: deliveredOrder,
    };

    const productCategories = await getInventories({
      categories,
      productsCount,
    });

    const stockAvailablity = {
      inStock: productsCount - outOfStock,
      outOfStock,
    };

    const grossIncome = allOrders.reduce(
      (prev, order) => prev + (order.total || 0),
      0
    );

    const discount = allOrders.reduce(
      (prev, order) => prev + (order.discount || 0),
      0
    );

    const productionCost = allOrders.reduce(
      (prev, order) => prev + (order.shippingCharges || 0),
      0
    );

    const burnt = allOrders.reduce((prev, order) => prev + (order.tax || 0), 0);

    const marketingCost = Math.round(grossIncome * (30 / 100));

    const netMargin =
      grossIncome - discount - productionCost - burnt - marketingCost;

    const revenueDistribution = {
      netMargin,
      discount,
      productionCost,
      burnt,
      marketingCost,
    };

    const usersAgeGroup = {
      teen: allUsers.filter((i) => i.age < 20).length,
      adult: allUsers.filter((i) => i.age >= 20 && i.age < 40).length,
      old: allUsers.filter((i) => i.age >= 40).length,
    };

    const adminCustomer = {
      admin: adminUsers,
      customer: customerUsers,
    };

    charts = {
      orderFullfillment,
      productCategories,
      stockAvailablity,
      revenueDistribution,
      usersAgeGroup,
      adminCustomer,
    };

    myCache.set(key, JSON.stringify(charts));
  }

  return res.status(200).json({
    success: true,
    charts,
  });
});

export const getBarCharts = TryCatch(async (req, res, next) => {
  let charts;
  const key = "admin-bar-charts";

  if (myCache.has(key)) charts = JSON.parse(myCache.get(key) as string);
  else {
    const today = new Date();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const sixMonthProductPromise = Product.find({
      createdAt: {
        $gte: sixMonthsAgo,
        $lte: today,
      },
    }).select("createdAt");

    const sixMonthUsersPromise = User.find({
      createdAt: {
        $gte: sixMonthsAgo,
        $lte: today,
      },
    }).select("createdAt");

    const twelveMonthOrdersPromise = Order.find({
      createdAt: {
        $gte: twelveMonthsAgo,
        $lte: today,
      },
    }).select("createdAt");

    const [products, users, orders] = await Promise.all([
      sixMonthProductPromise,
      sixMonthUsersPromise,
      twelveMonthOrdersPromise,
    ]);

    const productCounts = getChartData({ length: 6, today, docArr: products });
    const usersCounts = getChartData({ length: 6, today, docArr: users });
    const ordersCounts = getChartData({ length: 12, today, docArr: orders });

    charts = {
      users: usersCounts,
      products: productCounts,
      orders: ordersCounts,
    };

    myCache.set(key, JSON.stringify(charts));
  }

  return res.status(200).json({
    success: true,
    charts,
  });
});

export const getLineCharts = TryCatch(async (req, res, next) => {
  let charts;
  const key = "admin-line-charts";

  if (myCache.has(key)) charts = JSON.parse(myCache.get(key) as string);
  else {
    const today = new Date();

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const baseQuery = {
      createdAt: {
        $gte: twelveMonthsAgo,
        $lte: today,
      },
    };

    const [products, users, orders] = await Promise.all([
      Product.find(baseQuery).select("createdAt"),
      User.find(baseQuery).select("createdAt"),
      Order.find(baseQuery).select(["createdAt", "discount", "total"]),
    ]);

    const productCounts = getChartData({ length: 12, today, docArr: products });
    const usersCounts = getChartData({ length: 12, today, docArr: users });
    const discount = getChartData({
      length: 12,
      today,
      docArr: orders,
      property: "discount",
    });
    const revenue = getChartData({
      length: 12,
      today,
      docArr: orders,
      property: "total",
    });

    charts = {
      users: usersCounts,
      products: productCounts,
      discount,
      revenue,
    };

    myCache.set(key, JSON.stringify(charts));
  }

  return res.status(200).json({
    success: true,
    charts,
  });
});
