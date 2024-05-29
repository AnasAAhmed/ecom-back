import express from "express";
import {
  deleteUser,
  getAllUsers,
  getUser,
  newUser,
  updateUser,
  deleteSingleUser,
} from "../controllers/user.js";
import { adminOnly } from "../middlewares/auth.js";

const app = express.Router();

// route - /api/v1/user/new
app.post("/new", newUser);

// route - /api/v1/user/update
app.put("/update", updateUser);

// Route - /api/v1/user/all
app.get("/all", adminOnly, getAllUsers);

// Route - /api/v1/user/delete USER BY HIMSELF ONLY. CAN DELETE & GET ALL DETAILS
app.delete("/delete/:id", deleteSingleUser);

// Route - /api/v1/user/dynamicID BY ADMIN ONLY. CAN DELETE & GET ALL USERS
app.route("/:id").get(getUser).delete(adminOnly, deleteUser);

export default app;
