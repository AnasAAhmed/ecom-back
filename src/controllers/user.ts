import { NextFunction, Request, Response } from "express";
import { User } from "../models/user.js";
import { NewUserRequestBody, UserBaseQuery, UserSearchQuery } from "../types/types.js";
import { TryCatch } from "../middlewares/error.js";
import ErrorHandler from "../utils/utility-class.js";
import { isValidObjectId } from "mongoose";

export const newUser = TryCatch(
  async (
    req: Request<{}, {}, NewUserRequestBody>,
    res: Response,
    next: NextFunction
  ) => {
    const { name, email, photo, gender, _id, phone, dob } = req.body;

    let user = await User.findById(_id);

    if (user)
      return res.status(200).json({
        success: true,
        message: `Welcome, ${user.name}`,
      });

    if (!_id || !name || !email || !photo || !gender || !dob || !phone)
      return next(new ErrorHandler("Please add all fields", 400));

    user = await User.create({
      name,
      email,
      photo,
      phone,
      gender,
      _id,
      dob: new Date(dob),
    });

    return res.status(201).json({
      success: true,
      message: `Welcome, ${user.name}`,
    });
  }
);

export const getAllUsers = TryCatch(async (req: Request, res: Response) => {
  const query = req.query.query || '';
  const key = req.query.key || '';
  const page = Number(req.query.page) - 1 || 0;

  let search: { [key: string]: any } = {};

  if (query) {
    if (key === 'email') search = { email: { $regex: query, $options: 'i' } };
    if (key === '_id' || isValidObjectId(query)) search = { _id: query };
    if (key === 'name') search = { name: { $regex: query, $options: 'i' } };
    if (key === 'role') search = { role: query };
    if (key === 'gender') search = { gender: query }
    if (key === 'phone') search = { phone: Number(query) };
  };


  const totalUsers = await User.countDocuments();

  const users = await User.find(search)
    .sort({ createdAt: -1 })
    .limit(10)
    .skip(page * 10);

  const totalPages = Math.ceil(totalUsers / 10);

  return res.status(200).json({
    success: true,
    totalPages,
    totalUsers,
    users,
  });
});

export const getUser = TryCatch(async (req, res, next) => {
  const id = req.params.id;
  const user = await User.findById(id);

  if (!user) return next(new ErrorHandler("User Not found", 400));

  return res.status(200).json({
    success: true,
    user,
  });
});

export const updateUser = TryCatch(async (req, res, next) => {
  const { name, dob, phone, gender, id } = req.body;
  const user = await User.findById(id);

  if (!user) return next(new ErrorHandler("User Not Found", 404));


  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (gender) user.gender = gender;
  if (dob) user.dob = dob;

  await user.save();


  return res.status(200).json({
    success: true,
    message: "User Updated Successfully",
  });
});

//ONLY USER HIMSELF  CAN ACCES THIS
export const deleteSingleUser = TryCatch(async (req, res, next) => {
  const id = req.params.id;
  const user = await User.findById(id);

  if (!user) return next(new ErrorHandler("Invalid Id", 400));

  await user.deleteOne();

  return res.status(200).json({
    success: true,
    message: "User Deleted Successfully",
  });
});


//ONLY ADMIN CAN ACCES THIS
export const deleteUser = TryCatch(async (req, res, next) => {
  const id = req.params.id;
  const user = await User.findById(id);

  if (!user) return next(new ErrorHandler("Invalid Id", 400));

  await user.deleteOne();

  return res.status(200).json({
    success: true,
    message: "User Deleted Successfully",
  });
});
