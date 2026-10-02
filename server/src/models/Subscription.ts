import mongoose, { Document, Schema } from 'mongoose';

export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'paused';

export interface ISubscription extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  plan: 'free' | 'pro';
  status: SubscriptionStatus;
  razorpaySubscriptionId?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  currentPeriodEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      unique: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'past_due', 'paused'],
      default: 'active',
      required: true,
    },
    razorpaySubscriptionId: {
      type: String,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpayOrderId: {
      type: String,
    },
    currentPeriodEnd: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
