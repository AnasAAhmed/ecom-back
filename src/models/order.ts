import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    shippingInfo: {
      address: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
      pinCode: {
        type: Number,
        required: true,
      },
    },

    user: {
      type: String,
      ref: "User",
      required: true,
      index: true
    },

    subtotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      required: true,
    },
    shippingCharges: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Processing", "Shipped", "Delivered","Cancel"],
      default: "Processing",
    },

    orderItems: [
      {
        name: String,
        photo: String,
        price: Number,
        quantity: Number,
        size: String,
        color: String,
        variantId: String,
        productId: {
          type: mongoose.Types.ObjectId,
          ref: "Product",
        },
        // status: {
        //   type: String,
        //   default: "Processing",
        // },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Order = mongoose.model("Order", schema);
