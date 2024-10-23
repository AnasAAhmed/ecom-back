import express from "express";
import { adminOnly } from "../middlewares/auth.js";
import {
  deleteProduct,
  getAdminProducts,
  getAllCategories,
  getAllProducts,
  getSingleProduct,
  getlatestProducts,
  newProduct,
  updateProduct,
  getLatestCategoryOrTopProducts,
  getCollectionsProducts,
  getAllCollections,
  deleteReview,
  createProductReview
} from "../controllers/product.js";
import { multipleUpload } from "../middlewares/multer.js";

const app = express.Router();

app.post("/new", adminOnly, multipleUpload, newProduct);

app.get("/all", getAllProducts);

app.get("/latest", getlatestProducts);

app.get("/category-top", getLatestCategoryOrTopProducts);

app.get("/allcollections/:collection", getCollectionsProducts);

app.get("/collections", getAllCollections);

app.post("/new-reviews/:productId", createProductReview);
app.delete("/delete-review", deleteReview);

app.get("/categories", getAllCategories);

app.get("/admin-products", adminOnly, getAdminProducts);

app
  .route("/:id")// its basically :slug not :id
  .get(getSingleProduct)
  .put(adminOnly, multipleUpload, updateProduct)
  .delete(adminOnly, deleteProduct);

export default app;
