import mongoose, { Document, Schema } from 'mongoose';

export type PaymentStatus =
  | 'CREATED'
  | 'APPROVED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED';

export interface IPayment extends Document {
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  provider: 'PAYPAL';
  providerOrderId: string;
  captureId?: string;
  amount: number;
  currency: 'USD';
  status: PaymentStatus;
  payerEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['PAYPAL'],
      required: true,
      default: 'PAYPAL',
    },
    providerOrderId: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      trim: true,
    },
    captureId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      enum: ['USD'],
      required: true,
      default: 'USD',
    },
    status: {
      type: String,
      enum: ['CREATED', 'APPROVED', 'CAPTURED', 'FAILED', 'CANCELLED'],
      required: true,
      default: 'CREATED',
    },
    payerEmail: {
      type: String,
      trim: true,
    },
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

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
