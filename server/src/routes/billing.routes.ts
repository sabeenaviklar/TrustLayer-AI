import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Workspace } from '../models/Workspace';
import { Subscription } from '../models/Subscription';
import { UsageRecord } from '../models/UsageRecord';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';
import { requireWorkspaceMember, requireWorkspaceOwner } from '../middleware/workspaceAccess';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { UsageService, PLAN_LIMITS } from '../services/usageService';
import { RazorpayService } from '../services/razorpayService';
import { env } from '../config/env';

const router = Router();

const verifyPaymentSchema = z.object({
  body: z.object({
    razorpayOrderId: z.string().min(1, 'Order ID is required'),
    razorpayPaymentId: z.string().min(1, 'Payment ID is required'),
    razorpaySignature: z.string().min(1, 'Signature is required'),
  }),
});

// GET /api/v1/workspaces/:id/billing - Get billing details & subscription status
router.get(
  '/:id/billing',
  authenticateJWT,
  requireWorkspaceMember,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workspaceId = new mongoose.Types.ObjectId(req.workspaceId);
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) throw new AppError('Workspace not found', 404, 'NOT_FOUND');

      let subscription = await Subscription.findOne({ workspaceId });
      if (!subscription) {
        subscription = await Subscription.create({
          workspaceId,
          plan: workspace.plan,
          status: 'active',
        });
      }

      const usage = await UsageService.getUsage(workspaceId);

      res.status(200).json({
        success: true,
        data: {
          plan: workspace.plan,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd || null,
          usage,
          limits: PLAN_LIMITS,
          pricing: {
            pro: {
              amountInPaise: 399900,
              currency: 'INR',
              formattedPrice: '₹3,999 / month',
              checkLimit: PLAN_LIMITS.pro,
            },
          },
          razorpayKeyId: env.RAZORPAY_KEY_ID,
          isMockMode: RazorpayService.isMockMode(),
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/workspaces/:id/billing/create-order - Create Razorpay upgrade order
router.post(
  '/:id/billing/create-order',
  authenticateJWT,
  requireWorkspaceOwner,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.workspaceId!;
      const order = await RazorpayService.createOrder(workspaceId);

      // Save order id to subscription
      await Subscription.findOneAndUpdate(
        { workspaceId: new mongoose.Types.ObjectId(workspaceId) },
        { razorpayOrderId: order.id },
        { upsert: true }
      );

      res.status(200).json({
        success: true,
        data: order,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/workspaces/:id/billing/verify-payment - Verify payment and upgrade to Pro
router.post(
  '/:id/billing/verify-payment',
  authenticateJWT,
  requireWorkspaceOwner,
  validate(verifyPaymentSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
      const workspaceId = new mongoose.Types.ObjectId(req.workspaceId);

      const isValid = RazorpayService.verifyPaymentSignature({
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        signature: razorpaySignature,
      });

      if (!isValid) {
        throw new AppError('Payment signature verification failed.', 400, 'INVALID_PAYMENT_SIGNATURE');
      }

      // 30 days subscription period
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);

      // Upgrade workspace to Pro
      const workspace = await Workspace.findByIdAndUpdate(
        workspaceId,
        { plan: 'pro' },
        { new: true }
      );

      // Update Subscription record
      const subscription = await Subscription.findOneAndUpdate(
        { workspaceId },
        {
          plan: 'pro',
          status: 'active',
          razorpayOrderId,
          razorpayPaymentId,
          currentPeriodEnd: nextMonth,
        },
        { upsert: true, new: true }
      );

      // Upgrade current month limit in UsageRecord
      const currentYearMonth = UsageService.getCurrentYearMonth();
      await UsageRecord.findOneAndUpdate(
        { workspaceId, yearMonth: currentYearMonth },
        { limit: PLAN_LIMITS.pro },
        { upsert: true }
      );

      const updatedUsage = await UsageService.getUsage(workspaceId);

      res.status(200).json({
        success: true,
        data: {
          message: 'Workspace successfully upgraded to Pro plan!',
          workspace: {
            id: workspace!._id,
            name: workspace!.name,
            plan: workspace!.plan,
          },
          subscription,
          usage: updatedUsage,
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/workspaces/:id/billing/cancel - Cancel Pro subscription
router.post(
  '/:id/billing/cancel',
  authenticateJWT,
  requireWorkspaceOwner,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workspaceId = new mongoose.Types.ObjectId(req.workspaceId);

      await Workspace.findByIdAndUpdate(workspaceId, { plan: 'free' });
      await Subscription.findOneAndUpdate(
        { workspaceId },
        { plan: 'free', status: 'cancelled' }
      );

      // Reset monthly usage limit to Free
      const currentYearMonth = UsageService.getCurrentYearMonth();
      await UsageRecord.findOneAndUpdate(
        { workspaceId, yearMonth: currentYearMonth },
        { limit: PLAN_LIMITS.free }
      );

      res.status(200).json({
        success: true,
        data: { message: 'Subscription cancelled. Downgraded to Free tier.' },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/billing/webhook - Webhook endpoint for Razorpay server-to-server events
export const webhookHandler = async (req: any, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawPayload = JSON.stringify(req.body);

    if (signature && !RazorpayService.verifyWebhookSignature(rawPayload, signature)) {
      throw new AppError('Invalid webhook signature', 400, 'INVALID_WEBHOOK_SIGNATURE');
    }

    const event = req.body.event;
    console.log(`[Razorpay Webhook] Received event: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid') {
      const orderNotes = req.body.payload?.payment?.entity?.notes || req.body.payload?.order?.entity?.notes;
      const workspaceId = orderNotes?.workspaceId;

      if (workspaceId && mongoose.Types.ObjectId.isValid(workspaceId)) {
        await Workspace.findByIdAndUpdate(workspaceId, { plan: 'pro' });
        await Subscription.findOneAndUpdate(
          { workspaceId: new mongoose.Types.ObjectId(workspaceId) },
          { plan: 'pro', status: 'active' },
          { upsert: true }
        );
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};

export default router;
