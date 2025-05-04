import { Request } from "express";
import { TryCatch } from "../middlewares/error.js";
import {
  BaseQuery,
  NewProductRequestBody,
  SearchRequestQuery,
} from "../types/types.js";
import { Product } from "../models/product.js";
import ErrorHandler from "../utils/utility-class.js";
import { rm } from "fs";
import { myCache } from "../app.js";
import { invalidateCache, slugify } from "../utils/features.js";
import { isValidObjectId } from "mongoose";

export const getlatestProducts = TryCatch(async (req, res, next) => {
  let products;

  if (myCache.has("latest-products"))
    products = JSON.parse(myCache.get("latest-products") as string);
  else {
    products = await Product.find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .select('-description -category -collections -reviews -createdAt -updatedAt -__v'); // Exclude unwanted fields
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
      .select('-description -category -collections -reviews -createdAt -updatedAt -__v');
  } else {
    products = await Product.find({ category })
      .sort({ createdAt: -1 })
      .limit(4)
      .select('-description -category -collections -reviews -createdAt -updatedAt -__v');
  }

  return res.status(200).json({
    success: true,
    products,
  });
});

export const getCollectionsProducts = TryCatch(
  async (req, res, next) => {
    const { sort, price, sortField, color, size } = req.query;
    const { collection } = req.params;

    const page = Number(req.query.page) || 1;
    const limit = Number(process.env.PRODUCT_PER_PAGE) || 8;
    const skip = (page - 1) * limit;

    const baseQuery: BaseQuery = {};

    if (collection) baseQuery.collections = collection;

    if (color || size) {
      const searchTerms = [color, size].filter(Boolean).join(" ");
      baseQuery.searchableVariants = {
        $regex: searchTerms,
        $options: "i",
      };
    }

    if (price) {
      baseQuery.price = {
        $lte: Number(price),
      };
    }

    const sortOptions: { [key: string]: 1 | -1 } = {};
    if (sort && sortField) {
      const sortOrder = sort === "asc" ? 1 : -1;
      sortOptions[sortField as string] = sortOrder;
    } else {
      sortOptions.createdAt = -1; // Default sort: newest first
    }

    const totalProducts = await Product.countDocuments(baseQuery);
    const totalPage = Math.ceil(totalProducts / limit);

    if (totalProducts === 0) {
      return res.status(200).json({
        success: true,
        productCollection: [],
        totalPage: 0,
      });
    }

    const productCollection = await Product.find(baseQuery)
      .limit(limit)
      .skip(skip)
      .sort(sortOptions)
      .select('-description -variants -category -collections -reviews -createdAt -updatedAt -__v');

    return res.status(200).json({
      success: true,
      productCollection,
      totalPage,
    });
  }
);

export const getAllCollections = TryCatch(async (req, res, next) => {

  let collections;

  if (myCache.has("collections"))
    collections = JSON.parse(myCache.get("collections") as string);
  else {
    collections = await Product.distinct("collections").sort({ createdAt: 1 });
    myCache.set("collections", JSON.stringify(collections));
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

export const getSingleProduct = TryCatch(async (req, res, next) => {
  const { id } = req.query;
  let product;
  const slug = req.params.id;
  const unSlug = slug.replace(/-/g, " ");

  if (myCache.has(`product-${slug}`))
    product = JSON.parse(myCache.get(`product-${slug}`) as string);
  else {
    product = await Product.findOne({ slug }); //for admin

    if (!product) return next(new ErrorHandler("Product Not Found", 404));

    myCache.set(`product-${slug}`, JSON.stringify(product));
  }

  return res.status(200).json({
    success: true,
    product,
  });
});

export const productsStockUpdate = TryCatch(async (req, res, next) => {
  const productIdsHeader = req.headers['product-ids'] as string;

  if (!productIdsHeader) {
    return next(new ErrorHandler("Product-IDs header is missing", 400));
  }

  const productIds = JSON.parse(productIdsHeader) as string[];

  const products = await Product.find({ _id: { $in: productIds } }).select('_id variants stock');

  return res.status(200).json({
    success: true,
    products,
  });
});

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

  myCache.del(`product-${slugify(product.name)}`);
  myCache.del("latest-products");
  res.status(200).json({
    success: true,
    message: "Review Submitted",
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

  myCache.del(`product-${slugify(product.name)}`);
  myCache.del("latest-products");

  res.status(200).json({
    success: true,
    message: "Review Deleted",

  });
});

export const getAdminProducts = TryCatch(async (req, res) => {
  const query = req.query.query || '';
  const key = req.query.key || '';
  const page = Number(req.query.page) - 1 || 0;

  let search: { [key: string]: any } = {};

  if (query) {
    if (key === 'name') search = { name: { $regex: query, $options: 'i' } };
    if (key === '_id' || isValidObjectId(query)) search = { _id: query };
    if (key === 'category') search = { category: { $regex: query, $options: 'i' } };
    if (key === 'price') search = { price: { $lte: Number(query) } };
  }

  const totalProducts = await Product.countDocuments(search);

  const products = await Product.find(search)
    .sort({ createdAt: -1 })
    .limit(10)
    .skip(page * 10)
    .select('-description -category -collections -reviews -createdAt -updatedAt -__v');

  const totalPages = Math.ceil(totalProducts / 10);

  return res.status(200).json({
    success: true,
    totalPages,
    totalProducts,
    products,
  });
});

export const newProduct = TryCatch(
  async (req: Request<{}, {}, NewProductRequestBody>, res, next) => {
    const { name, price, cutPrice, description, stock, category, collections, variants } = req.body;
    const photos = req.files as Express.Multer.File[];

    if (!photos || photos.length === 0) return next(new ErrorHandler("Please add Photos", 400));

    if (!name || !price || !stock || !category || !description) {
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
      photos: photoPaths,
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

  product.cutPrice = cutPrice;
  product.variants = variants;
  product.collections = collections;
  if (name) product.name = name;
  if (price) product.price = price;
  if (description) product.description = description;
  if (stock) product.stock = stock;
  if (category) product.category = category.toLowerCase();

  await product.save();

  invalidateCache({
    product: true,
    productId: String(slugify(product.name)),
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
    productId: String(slugify(product.name)),
    admin: true,
  });

  return res.status(200).json({
    success: true,
    message: "Product Deleted Successfully",
  });
});

export const getAllProducts = TryCatch(
  async (req: Request<{}, {}, {}, SearchRequestQuery>, res, next) => {
    const { sort, category, price, sortField, color, size } = req.query;
    const search = req.query.search ? decodeURIComponent(req.query.search) : null;
    const page = Number(req.query.page) || 1;
    const limit = Number(process.env.PRODUCT_PER_PAGE) || 8;
    const skip = (page - 1) * limit;

    const baseQuery: BaseQuery = {};

    if (search)
      baseQuery.$text = {
        $search: search
      };
    if (color || size) {
      const searchTerms = [color, size].filter(Boolean).join(" ");
      baseQuery.searchableVariants = {
        $regex: searchTerms,
        $options: "i",
      };
    }

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
    const totalProducts = await Product.countDocuments(baseQuery);
    if (totalProducts === 0) {
      return res.status(200).json({
        success: true,
        products: [],
        totalPage: 0,
      });
    }
    const products = await Product.find(baseQuery)
      .sort(sortOptions)
      .limit(limit)
      .skip(skip)
      .select('-description -variants -category -collections -reviews -createdAt -updatedAt -__v'); // Exclude unwanted fields


    const totalPage = Math.ceil(totalProducts / limit);

    return res.status(200).json({
      success: true,
      products,
      totalPage,
    });
  }
);

