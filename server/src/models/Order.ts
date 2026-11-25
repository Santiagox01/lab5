import mongoose, { Document, Schema } from 'mongoose';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type OrderPaymentStatus =
  | 'PENDING'
  | 'CREATED'
  | 'APPROVED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED';

export type ShippingMethod = 'DIGITAL_INSTANT' | 'STANDARD' | 'EXPRESS';

export interface IOrderItem {
  bookId: mongoose.Types.ObjectId;
  title: string;
  author: string;
  format: string;
  coverUrl: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface IShippingAddress {
  fullName: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  notes?: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  userId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  shippingAddress: IShippingAddress;
  shippingMethod: ShippingMethod;
  shippingCost: number;
  trackingCode: string;
  subtotal: number;
  total: number;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  paypalOrderId?: string;
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    format: { type: String, required: true, trim: true },
    coverUrl: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0.01 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0.01 },
  },
  { _id: false }
);

const shippingAddressSchema = new Schema<IShippingAddress>(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    street: { type: String, required: true, trim: true, maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    postalCode: { type: String, required: true, trim: true, maxlength: 30 },
    country: { type: String, required: true, trim: true, maxlength: 80 },
    notes: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (val: IOrderItem[]) => Array.isArray(val) && val.length > 0,
        message: 'El pedido debe contener al menos un libro.',
      },
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    shippingMethod: {
      type: String,
      enum: ['DIGITAL_INSTANT', 'STANDARD', 'EXPRESS'],
      required: true,
      default: 'DIGITAL_INSTANT',
    },
    shippingCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    trackingCode: {
      type: String,
      trim: true,
      default: '',
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0.01,
    },
    total: {
      type: Number,
      required: true,
      min: 0.01,
    },
    status: {
      type: String,
      enum: [
        'PENDING_PAYMENT',
        'PAID',
        'PREPARING',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
      ],
      required: true,
      default: 'PENDING_PAYMENT',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'CREATED', 'APPROVED', 'CAPTURED', 'FAILED', 'CANCELLED'],
      required: true,
      default: 'PENDING',
    },
    paypalOrderId: {
      type: String,
      trim: true,
    },
    paidAt: { type: Date },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Order = mongoose.model<IOrder>('Order', orderSchema);
