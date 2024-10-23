import { TryCatch } from "../middlewares/error.js";
import { Notification } from "../models/notifications.js";

export const myNotifications = TryCatch(async (req, res, next) => {
    const { id } = req.params;

    const notifications = await Notification.find({ userId: id }).limit(6);

    return res.status(200).json({
        success: true,
        notifications,
    });
});

export const adminNotifications = TryCatch(async (req, res, next) => {

    const notifications = await Notification.find({}).limit(6);

    return res.status(200).json({
        success: true,
        notifications,
    });
});

export const deleteNotifications = TryCatch(async (req, res, next) => {
    const { id } = req.params;

    await Notification.findByIdAndDelete(id);

    return res.status(200).json({
        success: true,
        message: "Deleted Successfully",

    });
});