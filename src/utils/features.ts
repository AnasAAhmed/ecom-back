import mongoose, { Document } from "mongoose";
import { myCache } from "../app.js";
import { Product } from "../models/product.js";
import { InvalidateCacheProps, OrderItemType } from "../types/types.js";

export const connectDB = (uri: string) => {
  mongoose
    .connect(uri, {
      dbName: "Ecommerce_24",
    })
    .then((c) => console.log(`DB Connected to ${c.connection.host}`))
    .catch((e) => console.log(e));
};

export const invalidateCache = ({
  product,
  order,
  admin,
  userId,
  orderId,
  productId,
}: InvalidateCacheProps) => {
  if (product) {
    const productKeys: string[] = [
      "latest-products",
      "categories",
      "all-products",
    ];

    if (typeof productId === "string") productKeys.push(`product-${productId}`);

    if (typeof productId === "object")
      productId.forEach((i) => productKeys.push(`product-${i}`));

    myCache.del(productKeys);
  }
  if (order) {
    const ordersKeys: string[] = [
      "all-orders",
      `my-orders-${userId}`,
      `order-${orderId}`,
    ];

    myCache.del(ordersKeys);
  }
  if (admin) {
    myCache.del([
      "admin-stats",
      "admin-pie-charts",
      "admin-bar-charts",
      "admin-line-charts",
    ]);
  }
};

export const slugify = (title: string) => {
  return title
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
};
export function estimateWeight(categoryOrTitle: string): number {
  const input = categoryOrTitle.toLowerCase();

  if (input.includes("t-shirt") || input.includes("shirt")) return 0.3;
  if (input.includes("hoodie") || input.includes("jacket")) return 0.6;
  if (input.includes("shoes") || input.includes("sneakers")) return 1.0;
  if (input.includes("pants") || input.includes("trousers")) return 0.5;
  if (input.includes("accessory") || input.includes("belt") || input.includes("cap")) return 0.2;

  return 0.5;
}
export function statusValidation(status: string): string {
  const input = status.toLowerCase();

  if (input.includes("pending")) return "pending";
  if (input.includes("shipped")) return "shipped";
  if (input.includes("delivered")) return "delivered";
  if (input.includes("canceled")) return "canceled";

  return 'shipped';
}
type Dimensions = {
  length: number; // cm
  width: number;
  height: number;
};

export function estimateDimensions(categoryOrTitle: string): Dimensions {
  const input = categoryOrTitle.toLowerCase();

  if (input.includes("t-shirt") || input.includes("shirt")) {
    return { length: 30, width: 25, height: 2 };
  }

  if (input.includes("hoodie") || input.includes("jacket")) {
    return { length: 35, width: 30, height: 5 };
  }

  if (input.includes("shoes") || input.includes("sneakers")) {
    return { length: 35, width: 25, height: 12 };
  }

  if (input.includes("pants") || input.includes("trousers")) {
    return { length: 35, width: 28, height: 4 };
  }

  if (input.includes("accessory") || input.includes("cap") || input.includes("belt")) {
    return { length: 20, width: 15, height: 3 };
  }

  return { length: 30, width: 20, height: 5 };
}
export const reduceStock = async (orderItems: OrderItemType[]) => {
  for (let i = 0; i < orderItems.length; i++) {
    const order = orderItems[i];
    const product = await Product.findById(order.productId);
    if (!product) throw new Error("Product Not Found");

    // Find the matching variant
    if (order.size || order.color && order.variantId) {
      const variant = product.variants.find(v => v._id!.toString() === order.variantId);
      if (!variant) throw new Error(`Variant not ${order.variantId} found for product: ${order.productId}, size: ${order.size}, color: ${order.color}`);

      // Reduce the variant stock
      if (variant.stock! >= order.quantity) {
        variant.stock! -= order.quantity;
      } else {
        const pName = product.name
        console.error(`Not enough stock for variant: ${order.productId}, size: ${order.size}, color: ${order.color}`);
        throw new Error("Not enough stock for this variant of product " + { pName });
      }
    }

    // Reduce the general product stock
    if (product.stock >= order.quantity) {
      product.stock -= order.quantity;
      product.sold += order.quantity;
    } else {
      console.error(`Not enough stock for product: ${order.productId}`);
      throw new Error("Not enough stock for this Product");
    }
    await product.save();
  }
};

export const calculatePercentage = (thisMonth: number, lastMonth: number) => {
  if (lastMonth === 0) return thisMonth * 100;
  const percent = (thisMonth / lastMonth) * 100;
  return Number(percent.toFixed(0));
};

export const getInventories = async ({
  categories,
  productsCount,
}: {
  categories: string[];
  productsCount: number;
}) => {
  const categoriesCountPromise = categories.map((category) =>
    Product.countDocuments({ category })
  );

  const categoriesCount = await Promise.all(categoriesCountPromise);

  const categoryCount: Record<string, number>[] = [];

  categories.forEach((category, i) => {
    categoryCount.push({
      [category]: Math.round((categoriesCount[i] / productsCount) * 100),
    });
  });

  return categoryCount;
};
export const getCollections = async ({
  collections,
}: {
  collections: string[];
}) => {
  const collectionsCountPromise = collections.map((collection) =>
    Product.countDocuments({ collections: collection })
  );

  const collectionsCount = await Promise.all(collectionsCountPromise);

  const collectionCount: Record<string, number>[] = [];

  collections.forEach((collection, i) => {
    collectionCount.push({
      [collection]: Math.round((collectionsCount[i])),
    });
  });

  return collectionCount;
};

interface MyDocument extends Document {
  createdAt: Date;
  discount?: number;
  total?: number;
}
type FuncProps = {
  length: number;
  docArr: MyDocument[];
  today: Date;
  property?: "discount" | "total";
};

export const getChartData = ({
  length,
  docArr,
  today,
  property,
}: FuncProps) => {
  const data: number[] = new Array(length).fill(0);

  docArr.forEach((i) => {
    const creationDate = i.createdAt;
    const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;

    if (monthDiff < length) {
      if (property) {
        data[length - monthDiff - 1] += i[property]!;
      } else {
        data[length - monthDiff - 1] += 1;
      }
    }
  });

  return data;
};
