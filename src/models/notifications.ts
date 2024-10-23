import mongoose from "mongoose";

const schema = new mongoose.Schema({
    message: {
        type: String,
        required: [true, "Please enter the message"],
    },
    adminMessage: {
        type: String,
        required: [true, "Please enter the message"],
    },
    orderId: {
        type: mongoose.Types.ObjectId,
        ref: "Order",
        required: true,
        status: {
            type: String,
        },
    },
    productId: {
        type: mongoose.Types.ObjectId,
        ref: "Product",
        required: false,
        status: {
            type: String,
        },
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    isRead: {
        type: Boolean,
        default:false
    },
    status: {
        type: String,
    },
});

export const Notification = mongoose.model("Notification", schema);
