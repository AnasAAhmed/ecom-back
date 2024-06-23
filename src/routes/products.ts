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
  getProductReviews,
  createProductReview
} from "../controllers/product.js";
import { multipleUpload } from "../middlewares/multer.js";

const app = express.Router();

//To Create New Product  - /api/v1/product/new
app.post("/new", adminOnly, multipleUpload, newProduct);

//To get all Products with filters  - /api/v1/product/all
app.get("/all", getAllProducts);

//To get last 10 Products  - /api/v1/product/latest
app.get("/latest", getlatestProducts);

//Not latest. it is basically get(RELETAED)CategoryProducts && getBestSellingProducts
app.get("/category-top", getLatestCategoryOrTopProducts);

app.get("/allcollections/:collection", getCollectionsProducts);

//To get all unique Collections  - /api/v1/product/collections
app.get("/collections", getAllCollections);

app.get("/reviews", getProductReviews);
app.post("/new-reviews/:productId", createProductReview);
app.delete("/delete-review", deleteReview);

//To get all unique Categories  - /api/v1/product/categories
app.get("/categories", getAllCategories);

//To get all Products   - /api/v1/product/admin-products
app.get("/admin-products", adminOnly, getAdminProducts);

// To get, update, delete Product
app
  .route("/:id")
  .get(getSingleProduct)
  .put(adminOnly, multipleUpload, updateProduct)
  .delete(adminOnly, deleteProduct);

export default app;
