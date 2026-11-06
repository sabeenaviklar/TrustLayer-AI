import mongoose, { Document, Schema } from 'mongoose';

export interface IUsageReservation {
  reservationId: string;
  expiresAt: Date;
}

export interface IUsageRecord extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  yearMonth: string; // e.g. "2026-11"
  checkCount: number;
  limit: number;
  reservations: IUsageReservation[];
  createdAt: Date;
  updatedAt: Date;
}

const UsageReservationSchema = new Schema<IUsageReservation>(
  {
    reservationId: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const UsageRecordSchema = new Schema<IUsageRecord>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    yearMonth: {
      type: String,
      required: true,
      index: true,
    },
    checkCount: {
      type: Number,
      default: 0,
    },
    limit: {
      type: Number,
      default: 100,
    },
    reservations: {
      type: [UsageReservationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

UsageRecordSchema.index({ workspaceId: 1, yearMonth: 1 }, { unique: true });

export const UsageRecord = mongoose.model<IUsageRecord>('UsageRecord', UsageRecordSchema);
