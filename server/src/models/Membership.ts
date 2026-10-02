import mongoose, { Document, Schema } from 'mongoose';

export type WorkspaceRole = 'owner' | 'member';
export type MembershipStatus = 'active' | 'invited' | 'declined';

export interface IMembership extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  invitedEmail?: string;
  role: WorkspaceRole;
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipSchema = new Schema<IMembership>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    invitedEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['owner', 'member'],
      default: 'member',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'invited', 'declined'],
      default: 'active',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness per user/workspace
MembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true, sparse: true });
MembershipSchema.index({ workspaceId: 1, invitedEmail: 1 }, { unique: true, sparse: true });

export const Membership = mongoose.model<IMembership>('Membership', MembershipSchema);
