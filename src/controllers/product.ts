import { Request } from "express";
import { TryCatch } from "../middlewares/error.js";
import {
  BaseQuery,
  NewProductRequestBody,
  NewReviewRequestBody,
  SearchRequestQuery,
} from "../types/types.js";
import { Product } from "../models/product.js";
import ErrorHandler from "../utils/utility-class.js";
import { rm } from "fs";
import { myCache } from "../app.js";
import { invalidateCache } from "../utils/features.js";

// Revalidate on New,Update,Delete Product & on New Order
export const getlatestProducts = TryCatch(async (req, res, next) => {
  let products;

  if (myCache.has("latest-products"))
    products = JSON.parse(myCache.get("latest-products") as string);
  else {
    products = await Product.find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .select('-description -sizes -colors -category -collections -reviews -createdAt -updatedAt -__v'); // Exclude unwanted fields
    myCache.set("latest-products", JSON.stringify(products));
  }

  return res.status(200).json({
    success: true,
    products,
  });
});

//Not latest. it is basically get(RELETAED)CategoryProducts && getBestSellingProductsS
export const getLatestCategoryOrTopProducts = TryCatch(async (req, res, next) => {
  const { category } = req.query;

  let products;
  if (!category) {
    products = await Product.find({})
      .sort({ sold: -1, ratings: -1 })
      .limit(4)
      .select('-description -sizes -colors -category -collections -reviews -createdAt -updatedAt -__v');
  } else {
    products = await Product.find({ category })
      .sort({ createdAt: -1 })
      .limit(4)
      .select('-description -sizes -colors -category -collections -reviews -createdAt -updatedAt -__v');
  }

  return res.status(200).json({
    success: true,
    products,
  });
});

export const getCollectionsProducts = TryCatch(async (req, res, next) => {
  const { collection } = req.params;

  const productCollection = await Product.find({ collections: collection }).sort({ createdAt: -1 }).select('-description -sizes -colors -category -collections -reviews -createdAt -updatedAt -__v');

  return res.status(200).json({
    success: true,
    productCollection
  });
});

export const getAllCollections = TryCatch(async (req, res, next) => {

  // const collections = await Product.distinct("collections");
  let collections;

  if (myCache.has("collections"))
    collections = JSON.parse(myCache.get("collections") as string);
  else {
    collections = await Product.distinct("collections");
    myCache.set("categories", JSON.stringify(collections));
  }
  return res.status(200).json({
    success: true,
    collections: collections
  });
});


export const getAllCategories = TryCatch(async (req, res, next) => {
  let categories;

  if (myCache.has("categories"))
    categories = JSON.parse(myCache.get("categories") as string);
  else {
    categories = await Product.distinct("category");
    myCache.set("categories", JSON.stringify(categories));
  }

  return res.status(200).json({
    success: true,
    categories,
  });
});

// Revalidate on New,Update,Delete Product & on New Order
export const getAdminProducts = TryCatch(async (req, res, next) => {
  let products;
  if (myCache.has("all-products"))
    products = JSON.parse(myCache.get("all-products") as string);
  else {
    products = await Product.find({}).sort({ createdAt: -1 }).select('-description -variants -category -collections -reviews -createdAt -updatedAt -__v');
    myCache.set("all-products", JSON.stringify(products));
  }

  return res.status(200).json({
    success: true,
    products,
  });
});



export const getSingleProduct = TryCatch(async (req, res, next) => {
  let product;
  const id = req.params.id;
  if (myCache.has(`product-${id}`))
    product = JSON.parse(myCache.get(`product-${id}`) as string);
  else {
    product = await Product.findById(id);

    if (!product) return next(new ErrorHandler("Product Not Found", 404));

    myCache.set(`product-${id}`, JSON.stringify(product));
  }

  return res.status(200).json({
    success: true,
    product,
  });
});

export const newProduct = TryCatch(
  async (req: Request<{}, {}, NewProductRequestBody>, res, next) => {
    const { name, price, cutPrice, description, stock, category, collections, variants } = req.body;
    const photos = req.files as Express.Multer.File[];

    if (!photos || photos.length === 0) return next(new ErrorHandler("Please add Photos", 400));

    if (!name || !price || !stock || !category || !description ) {
      photos.forEach(photo => {
        rm(photo.path, () => {
          console.log("Deleted");
        });
      });

      return next(new ErrorHandler("Please enter All Fields", 400));
    }

    const photoPaths = photos.map(photo => photo.path);

    await Product.create({
      name,
      price,
      cutPrice,
      description,
      stock,
      category: category.toLowerCase(),
      collections: collections.toLowerCase(),
      variants,
      photos: photoPaths, // Store array of photo paths
    });

    invalidateCache({ product: true, admin: true });

    return res.status(201).json({
      success: true,
      message: "Product Created Successfully",
    });
  }
);

export const updateProduct = TryCatch(async (req, res, next) => {
  const { id } = req.params;
  const { name, price, cutPrice, description, stock, category, collections, variants } = req.body;
  const photos = req.files as Express.Multer.File[];

  const product = await Product.findById(id);

  if (!product) return next(new ErrorHandler("Product Not Found", 404));

  if (photos && photos.length > 0) {
    // Remove old photos
    product.photos.forEach(photo => {
      rm(photo, () => {
        console.log("Old Photo Deleted");
      });
    });

    // Update with new photos
    product.photos = photos.map(photo => photo.path);
  }

  if (name) product.name = name;
  if (price) product.price = price;
  if (description) product.description = description;
  if (cutPrice) product.cutPrice = cutPrice;
  if (collections) product.collections = collections;
  if (stock) product.stock = stock;
  if (category) product.category = category.toLowerCase();
  if (variants) product.variants = variants;
  // if (sizes) product.sizes = sizes;
  // if (colors) product.colors = colors;

  await product.save();

  invalidateCache({
    product: true,
    productId: String(product._id),
    admin: true,
  });

  return res.status(200).json({
    success: true,
    message: "Product Updated Successfully",
  });
});

export const deleteProduct = TryCatch(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new ErrorHandler("Product Not Found", 404));

  product.photos.forEach(photo => {
    rm(photo, () => {
      console.log("Old Photo Deleted");
    });
  });

  await product.deleteOne();

  invalidateCache({
    product: true,
    productId: String(product._id),
    admin: true,
  });

  return res.status(200).json({
    success: true,
    message: "Product Deleted Successfully",
  });
});

export const getAllProducts = TryCatch(
  async (req: Request<{}, {}, {}, SearchRequestQuery>, res, next) => {
    const { search, sort, category, price, sortField } = req.query;

    const page = Number(req.query.page) || 1;
    const limit = Number(process.env.PRODUCT_PER_PAGE) || 8;
    const skip = (page - 1) * limit;

    const baseQuery: BaseQuery = {};

    if (search)
      baseQuery.name = {
        $regex: search,
        $options: "i",
      };
    if (price)
      baseQuery.price = {
        $lte: Number(price),
      };
    if (category) baseQuery.category = category;

    const sortOptions: { [key: string]: 1 | -1 } = {};
    if (sort && sortField) {
      const sortOrder = sort === "asc" ? 1 : -1;
      sortOptions[sortField] = sortOrder;
    } else {
      sortOptions['createdAt'] = -1; // Default sort by createdAt descending
    }

    const productsPromise = Product.find(baseQuery)
      .sort(sortOptions)
      .limit(limit)
      .skip(skip)
      .select('-description -variants -category -collections -reviews -createdAt -updatedAt -__v'); // Exclude unwanted fields

    const [products, filteredOnlyProduct] = await Promise.all([
      productsPromise,
      Product.find(baseQuery),
    ]);

    const totalPage = Math.ceil(filteredOnlyProduct.length / limit);

    return res.status(200).json({
      success: true,
      products,
      totalPage,
    });
  }
);

export const createProductReview = TryCatch(async (req, res, next) => {
  const { rating, comment, email, name, userId, photo } = req.body;
  const productId = req.params.productId;

  if (!userId || !email || !name || !comment || !rating) return;
  const review = {
    userId,
    name,
    email,
    date: new Date(),
    rating: Number(rating),
    photo,
    comment,
  };

  const product = await Product.findById(productId);
  if (!product) return next(new ErrorHandler("Product not found", 404));

  const isReviewed = product.reviews.find(
    (rev) => rev.userId.toString() === userId.toString()
  );

  if (isReviewed) {
    for (const rev of product.reviews) {
      if (rev.userId.toString() === userId.toString()) {
        rev.rating = rating;
        rev.comment = comment;
        rev.date = new Date();
      }
    }
  } else {
    product.reviews.push(review);
    product.numOfReviews = product.reviews.length;
  }

  product.ratings = product.reviews.reduce((acc, rev) => acc + rev.rating, 0) / product.reviews.length;

  await product.save({ validateBeforeSave: false });

  myCache.del(`product-${productId}`);
  myCache.del("latest-products");
  res.status(200).json({
    success: true,
    message: "Review Submitted",
  });
});
// Get All Reviews of a Product
export const getProductReviews = TryCatch(async (req, res, next) => {
  const id = req.query.id!;
  const product = await Product.findById(id);
  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }
  res.status(200).json({
    success: true,
    reviews: product.reviews,
  });
});

// Delete Review
export const deleteReview = TryCatch(async (req, res, next) => {
  const idUser = req.query.id!
  const productId = req.query.productId!
  const product = await Product.findById(productId);

  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  const reviews = product.reviews.filter(
    (rev) => rev.userId.toString() !== idUser.toString()
  );

  let avg = 0;

  reviews.forEach((rev) => {
    avg += rev.rating;
  });

  let ratings = 0;

  if (reviews.length === 0) {
    ratings = 0;
  } else {
    ratings = avg / reviews.length;
  }

  const numOfReviews = reviews.length;

  await Product.findByIdAndUpdate(
    productId,
    {
      reviews,
      ratings,
      numOfReviews,
    },
    {
      new: true,
      runValidators: true,
      useFindAndModify: false,
    }
  );

  myCache.del(`product-${productId}`);
  myCache.del("latest-products");

  res.status(200).json({
    success: true,
    message: "Review Deleted",

  });
});