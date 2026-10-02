import mongoose, { Document, Schema } from 'mongoose';

export type OverallVerdict = 'SUPPORTED' | 'CONTRADICTED' | 'UNVERIFIABLE';

export interface IClaimItem {
  claim: string;
  verdict: OverallVerdict;
  confidence: number;
  evidenceSentence?: string | null;
  chunkId?: string | null;
  scores: {
    entailment: number;
    contradiction: number;
    neutral: number;
  };
}

export interface ICheckResult extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  documentId?: mongoose.Types.ObjectId;
  question: string;
  answer: string;
  overallVerdict: OverallVerdict;
  reliabilityScore: number;
  totalClaims: number;
  supportedCount: number;
  contradictedCount: number;
  unverifiableCount: number;
  claims: IClaimItem[];
  checkedBy: string; // userId or apiKeyId
  selfConsistencyAgreement?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const ClaimItemSchema = new Schema<IClaimItem>(
  {
    claim: { type: String, required: true },
    verdict: {
      type: String,
      enum: ['SUPPORTED', 'CONTRADICTED', 'UNVERIFIABLE'],
      required: true,
    },
    confidence: { type: Number, required: true },
    evidenceSentence: { type: String, default: null },
    chunkId: { type: String, default: null },
    scores: {
      entailment: { type: Number, default: 0 },
      contradiction: { type: Number, default: 0 },
      neutral: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const CheckResultSchema = new Schema<ICheckResult>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      index: true,
    },
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    },
    overallVerdict: {
      type: String,
      enum: ['SUPPORTED', 'CONTRADICTED', 'UNVERIFIABLE'],
      required: true,
      index: true,
    },
    reliabilityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true,
    },
    totalClaims: {
      type: Number,
      required: true,
    },
    supportedCount: {
      type: Number,
      required: true,
    },
    contradictedCount: {
      type: Number,
      required: true,
    },
    unverifiableCount: {
      type: Number,
      required: true,
    },
    claims: [ClaimItemSchema],
    checkedBy: {
      type: String,
      required: true,
    },
    selfConsistencyAgreement: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast dashboard aggregation and queries
CheckResultSchema.index({ workspaceId: 1, createdAt: -1 });
CheckResultSchema.index({ workspaceId: 1, overallVerdict: 1 });

export const CheckResult = mongoose.model<ICheckResult>('CheckResult', CheckResultSchema);
