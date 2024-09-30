import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter Name"],
      unique: true,
      index: true
    },
    photos: {
      type: [String],
      required: [true, "Please enter Photo"],
    },
    description: {
      type: String,
      required: [true, "Please enter Description"]
    },
    price: {
      type: Number,
      required: [true, "Please enter Price"],
    },
    cutPrice: {
      type: Number,
    },
    stock: {
      type: Number,
      required: [true, "Please enter Stock"],
    },
    category: {
      type: String,
      required: [true, "Please enter Category"],
      trim: true,
    },
    collections: {
      type: String,
      trim: true,
    },
    variants: [{
      size: { type: String },
      color: { type: String },
      stock: { type: Number },
    }],
    reviews: [
      {
        userId: {
          type: String,
          required: true,
        },
        email: {
          type: String,
          required: true,
        },
        photo: {
          type: String,
          required: true,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        name: {
          type: String,
          required: true,
        },
        rating: {
          type: Number,
          required: true,
        },
        comment: {
          type: String,
          required: true,
        },
      },
    ],
    numOfReviews: {
      type: Number,
      default: 0,
    },
    ratings: {
      type: Number,
      default: 0,
    },
    sold: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Product = mongoose.model("Product", schema);
