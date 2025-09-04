import { NextFunction, Request, Response } from "express";

export interface NewUserRequestBody {
  name: string;
  email: string;
  photo: string;
  phone: number;
  gender: string;
  _id: string;
  dob: Date;
}

export interface NewProductRequestBody {
  name: string;
  category: string;
  collections: string;
  description: string;
  price: number;
  cutPrice: number;
  stock: number;
  weight: number;
  dimensions: string;
  variants: [{
    size: string;
    color: string;
    stock: number;
  }];
  // sizes?: [{size:string,stock:number}];
  // colors?: [{color:string,stock:number}];
}
export interface NewReviewRequestBody {
  comment: string;
  user: string;
  productId: string;
  rating: number;
  photos?: string;
}



export type ControllerType = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response<any, Record<string, any>>>;

export type SearchRequestQuery = {
  search?: string;
  price?: string;
  size?: string;
  category?: string;
  color?: string;
  sort?: string;
  sortField?: string;
  page?: string;
};
export type UserSearchQuery = {
  email?: string;
  searchId?: string;
};
export type CollectionSearchQuery = {
  collection: string;
  limit?: string;
};

export interface UserBaseQuery {
  email?: {
    $regex: string;
    $options: string;
  };
  _id?: {
    $regex: string;
    $options: string;
  };

}

export interface BaseQuery {
  $text?: {
    $search: string;
  };
  collections?: string;
  searchableVariants?: {
    $regex: string;
  };
  $or?: any;
  price?: {
    $lte: number;
  };
  category?: string;
}

export type InvalidateCacheProps = {
  product?: boolean;
  order?: boolean;
  admin?: boolean;
  userId?: string;
  orderId?: string;
  productId?: string | string[];
};

export type OrderItemType = {
  name: string;
  photo: string;
  price: number;
  size?: string;
  color?: string;
  variantId?: string;
  quantity: number;
  productId: string;
};

export type ShippingInfoType = {
  address: string;
  city: string;
  state: string;
  country: string;
  pinCode: number;
};

export interface NewOrderRequestBody {
  shippingInfo: ShippingInfoType;
  user: string;
  subtotal: number;
  tax: number;
  shippingCharges: number;
  discount: number;
  total: number;
  orderItems: OrderItemType[];
}
