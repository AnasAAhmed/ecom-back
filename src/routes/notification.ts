import express from "express";
import { adminOnly } from "../middlewares/auth.js";
import { adminNotifications, deleteNotifications, myNotifications } from "../controllers/notification.js";

const app = express.Router();

app.route("/:id")
    .get(myNotifications)
    .delete(deleteNotifications);

// route - /api/v1/notifications/all
app.get("/all", adminOnly, adminNotifications);

export default app;
