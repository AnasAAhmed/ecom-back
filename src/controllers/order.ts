import { Request } from "express";
import { TryCatch } from "../middlewares/error.js";
import { NewOrderRequestBody } from "../types/types.js";
import { Order } from "../models/order.js";
import { invalidateCache, reduceStock, slugify } from "../utils/features.js";
import ErrorHandler from "../utils/utility-class.js";
import { io, myCache } from "../app.js";
import { isValidObjectId } from "mongoose";
import { Notification } from "../models/notifications.js";

export const myOrders = TryCatch(async (req, res, next) => {
  const { id: user } = req.query;
  const page = Number(req.query.page) - 1 || 0;

  const orders = await Order.find({ user }).limit(10).skip(page * 10);
  const totalOrders = await Order.countDocuments();
  const totalPages = Math.ceil(totalOrders / 10);

  return res.status(200).json({
    success: true,
    totalPages,
    totalOrders,
    orders,
  });
});

export const allOrders = TryCatch(async (req, res, next) => {
  const query = req.query.query || '';
  const key = req.query.key || '';
  const page = Number(req.query.page) - 1 || 0;

  let search: { [key: string]: any } = {};

  if (query) {
    if (key === 'user') search = { user: query };
    if (key === '_id' || isValidObjectId(query)) search = { _id: query };
    if (key === 'status') search = { status: { $regex: query, $options: 'i' } };
    if (key === 'createdAt') {
      const startDate = new Date(query as string);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      search = {
        createdAt: {
          $gte: startDate,
          $lt: endDate
        }
      };
    }
  }

  const totalOrders = await Order.countDocuments();

  const orders = await Order.find(search).populate("user", "name email phone")
    .sort({ createdAt: -1 })
    .limit(10)
    .skip(page * 10)
    .select('-description -variants -category -collections -reviews -updatedAt -__v');

  const totalPages = Math.ceil(totalOrders / 10);

  return res.status(200).json({
    success: true,
    totalPages,
    totalOrders,
    orders,
  });
});

export const getSingleOrder = TryCatch(async (req, res, next) => {
  const { id } = req.params;
  const key = `order-${id}`;

  let order;

  if (myCache.has(key)) order = JSON.parse(myCache.get(key) as string);
  else {
    order = await Order.findById(id).populate("user", "name email phone");

    if (!order) return next(new ErrorHandler("Order Not Found", 404));

    myCache.set(key, JSON.stringify(order));
  }
  return res.status(200).json({
    success: true,
    order,
  });
});

export const newOrder = TryCatch(
  async (req: Request<{}, {}, NewOrderRequestBody>, res, next) => {
    const {
      shippingInfo,
      orderItems,
      user,
      subtotal,
      tax,
      shippingCharges,
      discount,
      total,
    } = req.body;

    if (!shippingInfo || !orderItems || !user || !subtotal || !tax || !total)
      return next(new ErrorHandler("Please Enter All Fields", 400));

    await reduceStock(orderItems);

    const order = await Order.create({
      shippingInfo,
      orderItems,
      user,
      subtotal,
      tax,
      shippingCharges,
      discount,
      total,
    });


    invalidateCache({
      product: true,
      order: true,
      admin: true,
      userId: user,
      productId: order.orderItems.map((i) => String(slugify(i.name!))),
    });
    await Notification.create({
      message: `Your order (${order._id}) has been placed`,
      adminMessage: `A New order (${order._id}) has been placed`,
      orderId: String(order._id),
      userId: order.user,
      status: order.status,
      isAdmin: false,
    })

    io.emit("adminNotification", {
      message: '',
      adminMessage: `A New order (${order._id}) has been placed`,
      orderId: String(order._id),
      userId: user,
      status: "New",
    });


    return res.status(201).json({
      success: true,
      message: "Order Placed Successfully",
    });
  }
);

export const processOrder = TryCatch(async (req, res, next) => {
  const { id } = req.params;

  const order = await Order.findById(id);

  if (!order) return next(new ErrorHandler("Order Not Found", 404));

  switch (order.status) {
    case "Processing":
      order.status = "Shipped";
      break;
    case "Shipped":
      order.status = "Delivered";
      break;
    case "Delivered":
      order.status = "Cancel";
      break;
    default:
      order.status = "Delivered";
      break;
  }

  await order.save();

  const message = `Your order (${order._id}) has been ${order.status}`;
  const adminMessage = `This ${order._id} has been ${order.status}`;

  await Notification.create({
    message,
    adminMessage,
    orderId: order._id,
    userId: order.user,
    status: order.status,
  });

  io.emit("adminNotification", {
    message: '',
    adminMessage: `This ${order._id} has been ${order.status}`,
    orderId: String(order._id),
    userId: order.user,
    status: order.status,
  });

  invalidateCache({
    product: false,
    order: true,
    admin: true,
    userId: order.user,
    orderId: String(order._id),
  });

  return res.status(200).json({
    success: true,
    message: "Order Processed Successfully",
  });
});

export const deleteOrder = TryCatch(async (req, res, next) => {
  const { id } = req.params;

  const order = await Order.findById(id);
  if (!order) return next(new ErrorHandler("Order Not Found", 404));

  await order.deleteOne();

  const message = `Your order (${order._id}) has been ${order.status}`;
  const adminMessage = `This ${order._id} has been ${order.status}`;

  await Notification.create({
    message,
    adminMessage,
    orderId: order._id,
    userId: order.user,
    status: order.status,
  });

  io.emit("adminNotification", {
    message: '',
    adminMessage: `This ${order._id} has been ${order.status}`,
    orderId: String(order._id),
    userId: order.user,
    status: order.status,
  });

  invalidateCache({
    product: false,
    order: true,
    admin: true,
    userId: order.user,
    orderId: String(order._id),
  });

  return res.status(200).json({
    success: true,
    message: "Order Deleted Successfully",
  });
});

// export const processOrder = TryCatch(async (req, res, next) => {
//   const { id, productId, status } = req.params;
//   const order = await Order.findById(id);
//   let message = '';
//   let product: any = null;

//   if (!order) return next(new ErrorHandler("Order Not Found", 404));

//   if (productId) {
//     product = order.orderItems.find((item) => String(item.productId) === productId);

//     if (!product) return next(new ErrorHandler("Product not found in the order", 404));

//     product.status = status;

//     await order.save();

//     const allShipped = order.orderItems.every((item) => item.status === "Shipped");
//     const allDelivered = order.orderItems.every((item) => item.status === "Delivered");
//     const allCancelled = order.orderItems.every((item) => item.status === "Cancelled");
//     const anyProcessing = order.orderItems.some((item) => item.status === "Processing");

//     if (allDelivered) order.status = "Delivered";
//     else if (allShipped) order.status = "Shipped";
//     else if (anyProcessing) order.status = "Processing";
//     else if (allCancelled) order.status = "Cancelled";
//     else order.status = "Partially Fulfilled"; 

//     message = `Your product (${product.name}) has been updated to ${product.status}`;
//   } else {
//     order.status = status;

//     message = `Your order (${order._id}) has been updated to ${order.status}`;
//   }

//   await order.save();

//   const notification = await Notification.create({
//     message: message,
//     orderId: order._id,
//     productId: productId || null,
//     userId: order.user,
//     status: productId ? "Prodcut " + product.status + " Overall order " + order.status : "Overall order " + order.status,
//     isAdmin: false,
//   });

//   io.on("connection", (socket) => {
//     console.log("A admin connected: " + socket.id);

//     io.emit("adminNotification", {
//       message: "A new order has been placed",
//       orderId: String(order._id),
//       userId: order.user,
//       status: "New",
//     });

//   });

//   invalidateCache({
//     product: false,
//     order: true,
//     admin: true,
//     userId: order.user,
//     orderId: String(order._id),
//   });

//   return res.status(200).json({
//     success: true,
//     message: "Order Processed Successfully",
//     order,
//     notification,
//   });
// });
