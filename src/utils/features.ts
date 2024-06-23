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

// export const reduceStock = async (orderItems: OrderItemType[]) => {
//   for (let i = 0; i < orderItems.length; i++) {
//     const order = orderItems[i];
//     const product = await Product.findById(order.productId);
//     if (!product) throw new Error("Product Not Found");

//     // Reduce the general stock
//     if (product.stock >= order.quantity) {
//       product.stock -= order.quantity;
//       product.sold += order.quantity;
//     }else {
//       console.error(`Not enough stock for product: ${order.productId}`);
//       throw new Error("Not enough stock for this Product");
//     }

//     // Reduce the size stock if specified
//     if (order.size) {
//       const sizeItem = product.sizes.find(size => size.size === order.size);
//       if (sizeItem) {
//         sizeItem.stock! -= order.quantity;
//         if (sizeItem.stock! < 0) throw new Error("Not enough stock for the specified size");
//       } else {
//         throw new Error(`Size ${order.size} not found for product ${order.productId}`);
//       }
//     }

//     // Reduce the color stock if specified
//     if (order.color) {
//       const colorItem = product.colors.find(color => color.color === order.color);
//       if (colorItem) {
//         colorItem.stock! -= order.quantity;
//         if (colorItem.stock! < 0) throw new Error("Not enough stock for the specified color");
//       } else {
//         throw new Error(`Color ${order.color} not found for product ${order.productId}`);
//       }
//     }

//     await product.save();

//   }
// };

export const reduceStock = async (orderItems: OrderItemType[]) => {
  for (let i = 0; i < orderItems.length; i++) {
    const order = orderItems[i];
    const product = await Product.findById(order.productId);
    if (!product) throw new Error("Product Not Found");

    // Reduce the general product stock
    if (product.stock >= order.quantity) {
      product.stock -= order.quantity;
      product.sold += order.quantity;
    } else {
      console.error(`Not enough stock for product: ${order.productId}`);
      throw new Error("Not enough stock for this Product");
    }

    // Find the matching variant
    if (order.size || order.color) {
      const variant = product.variants.find(v => v._id!.toString() === order.variantId);
      if (!variant) throw new Error(`Variant not ${order.variantId} found for product: ${order.productId}, size: ${order.size}, color: ${order.color}`);

      // Reduce the variant stock
      if (variant.stock! >= order.quantity) {
        variant.stock! -= order.quantity;
      } else {
        console.error(`Not enough stock for variant: ${order.productId}, size: ${order.size}, color: ${order.color}`);
        throw new Error("Not enough stock for this variant");
      }
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
