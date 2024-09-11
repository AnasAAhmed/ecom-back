import { NextFunction, Request, Response } from "express";
import { User } from "../models/user.js";
import { NewUserRequestBody, UserBaseQuery, UserSearchQuery } from "../types/types.js";
import { TryCatch } from "../middlewares/error.js";
import ErrorHandler from "../utils/utility-class.js";

export const newUser = TryCatch(
  async (
    req: Request<{}, {}, NewUserRequestBody>,
    res: Response,
    next: NextFunction
  ) => {
    const { name, email, photo, gender, _id,phone, dob } = req.body;

    let user = await User.findById(_id);

    if (user)
      return res.status(200).json({
        success: true,
        message: `Welcome, ${user.name}`,
      });

    if (!_id || !name || !email || !photo || !gender || !dob||!phone)
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

export const getAllUsers = TryCatch(async(req: Request<{}, {}, {}, UserSearchQuery>, res:Response, next) => {

  const { email,searchId } = req.query;

  const baseQuery: UserBaseQuery = {};

  if (email)
    baseQuery.email = {
      $regex: email,
      $options: "i",
    };

  if (searchId)
    baseQuery._id = {
      $regex: searchId,
      $options: "i",
    };

  const users = await User.find(baseQuery);

  return res.status(200).json({
    success: true,
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
  const { name, dob, phone, gender,id} = req.body;
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
