import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from './config/database';
import { User } from './models/User';
import { Workspace } from './models/Workspace';
import { Membership } from './models/Membership';
import { Document } from './models/Document';
import { CheckResult } from './models/CheckResult';
import { Subscription } from './models/Subscription';
import { UsageRecord } from './models/UsageRecord';
import { aiServiceClient } from './services/aiServiceClient';

async function seed() {
  console.log('🌱 Starting TrustLayer Database Seeder...');
  await connectDB();

  // 1. Create or update Demo User
  const demoEmail = 'demo@trustlayer.ai';
  let demoUser = await User.findOne({ email: demoEmail });

  if (!demoUser) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);
    demoUser = await User.create({
      name: 'Demo Admin',
      email: demoEmail,
      passwordHash,
    });
    console.log('  ✅ Created demo user: demo@trustlayer.ai (password: Password123!)');
  } else {
    console.log('  ℹ️  Demo user already exists.');
  }

  // 2. Create or find Demo Workspace
  let workspace = await Workspace.findOne({ ownerId: demoUser._id });
  if (!workspace) {
    workspace = await Workspace.create({
      name: 'Acme Enterprise AI',
      slug: 'acme-enterprise-ai',
      ownerId: demoUser._id,
      plan: 'pro',
    });

    await Membership.create({
      workspaceId: workspace._id,
      userId: demoUser._id,
      role: 'owner',
      status: 'active',
    });

    await Subscription.create({
      workspaceId: workspace._id,
      plan: 'pro',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await UsageRecord.create({
      workspaceId: workspace._id,
      yearMonth,
      checkCount: 14,
      limit: 5000,
    });

    console.log(`  ✅ Created workspace: "${workspace.name}" with Pro plan`);
  } else {
    console.log(`  ℹ️  Workspace "${workspace.name}" already exists.`);
  }

  const workspaceIdStr = workspace._id.toString();

  // 3. Ingest Demo Reference Document
  const sampleDocTitle = 'TrustLayer_Company_Architecture_and_Policies.txt';
  const sampleDocContent = `TrustLayer Enterprise Overview and Product Architecture:
TrustLayer is an enterprise AI safety and compliance SaaS platform founded in 2024 and headquartered in San Francisco, California.
TrustLayer provides automated hallucination detection and truth grounding verification for large language models (LLMs).
The platform offers two pricing tiers: a Free Starter plan offering 100 verification checks per month, and a Pro Business plan costing $49 per month (or ₹3,999 INR per month) offering 5,000 checks per month.
TrustLayer uses a natural language inference pipeline powered by DeBERTa-v3 cross-encoders and ChromaDB vector search to split answers into individual atomic claims, retrieve evidence passages, and classify claims into SUPPORTED, CONTRADICTED, or UNVERIFIABLE.
Data is encrypted at rest using AES-256 and in transit using TLS 1.3. TrustLayer supports team collaboration and provides developer API keys with sub-100ms verification.
Enterprise SLA guarantees 99.9% uptime for AI model verification workloads. All customer vector spaces are logically isolated in separate ChromaDB collections.`;

  let doc = await Document.findOne({ workspaceId: workspace._id, title: sampleDocTitle });
  if (!doc) {
    try {
      const ingestResult = await aiServiceClient.ingestDocument(
        workspaceIdStr,
        sampleDocTitle,
        sampleDocContent,
        { category: 'demo-policy', author: 'TrustLayer System' }
      );

      doc = await Document.create({
        workspaceId: workspace._id,
        title: sampleDocTitle,
        filename: sampleDocTitle,
        mimeType: 'text/plain',
        fileSize: Buffer.byteLength(sampleDocContent, 'utf-8'),
        chunkCount: ingestResult.chunk_count || 3,
        status: 'ready',
        uploadedBy: demoUser._id,
      });

      console.log(`  ✅ Ingested demo reference document: "${sampleDocTitle}" into ChromaDB collection`);
    } catch (ingestErr) {
      console.warn(`  ⚠️ Could not ingest directly into AI service (might be starting up):`, ingestErr);
    }
  }

  // 4. Seed Realistic Verification History
  const existingChecks = await CheckResult.countDocuments({ workspaceId: workspace._id });
  if (existingChecks === 0) {
    const seedChecks = [
      {
        question: 'Where is TrustLayer headquartered and what plans are offered?',
        answer: 'TrustLayer is headquartered in San Francisco, California. The platform offers a Free Starter plan with 100 checks and a Pro Business plan with 5,000 checks per month.',
        overallVerdict: 'SUPPORTED',
        reliabilityScore: 98,
        totalClaims: 2,
        supportedCount: 2,
        contradictedCount: 0,
        unverifiableCount: 0,
        claims: [
          {
            claim: 'TrustLayer is headquartered in San Francisco, California.',
            verdict: 'SUPPORTED',
            confidence: 0.99,
            evidenceSentence: 'TrustLayer is an enterprise AI safety and compliance SaaS platform founded in 2024 and headquartered in San Francisco, California.',
            scores: { entailment: 0.99, contradiction: 0.0, neutral: 0.01 },
          },
          {
            claim: 'The platform offers a Free Starter plan with 100 checks and a Pro Business plan with 5,000 checks per month.',
            verdict: 'SUPPORTED',
            confidence: 0.98,
            evidenceSentence: 'The platform offers two pricing tiers: a Free Starter plan offering 100 verification checks per month, and a Pro Business plan costing $49 per month (or ₹3,999 INR per month) offering 5,000 checks per month.',
            scores: { entailment: 0.98, contradiction: 0.01, neutral: 0.01 },
          },
        ],
        checkedBy: `user:${demoUser._id}`,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        question: 'Where is TrustLayer located and what encryption is used?',
        answer: 'TrustLayer is located in Tokyo, Japan and uses simple plain-text passwords without any encryption.',
        overallVerdict: 'CONTRADICTED',
        reliabilityScore: 5,
        totalClaims: 2,
        supportedCount: 0,
        contradictedCount: 2,
        unverifiableCount: 0,
        claims: [
          {
            claim: 'TrustLayer is located in Tokyo, Japan.',
            verdict: 'CONTRADICTED',
            confidence: 0.97,
            evidenceSentence: 'TrustLayer is an enterprise AI safety and compliance SaaS platform founded in 2024 and headquartered in San Francisco, California.',
            scores: { entailment: 0.01, contradiction: 0.97, neutral: 0.02 },
          },
          {
            claim: 'It uses simple plain-text passwords without any encryption.',
            verdict: 'CONTRADICTED',
            confidence: 0.98,
            evidenceSentence: 'Data is encrypted at rest using AES-256 and in transit using TLS 1.3.',
            scores: { entailment: 0.0, contradiction: 0.98, neutral: 0.02 },
          },
        ],
        checkedBy: `user:${demoUser._id}`,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        question: 'What is the stock ticker for TrustLayer?',
        answer: 'TrustLayer trades on the NASDAQ exchange under the ticker symbol TLYR with a market cap of $10 billion.',
        overallVerdict: 'UNVERIFIABLE',
        reliabilityScore: 40,
        totalClaims: 1,
        supportedCount: 0,
        contradictedCount: 0,
        unverifiableCount: 1,
        claims: [
          {
            claim: 'TrustLayer trades on the NASDAQ exchange under the ticker symbol TLYR with a market cap of $10 billion.',
            verdict: 'UNVERIFIABLE',
            confidence: 0.85,
            evidenceSentence: null,
            scores: { entailment: 0.05, contradiction: 0.1, neutral: 0.85 },
          },
        ],
        checkedBy: `user:${demoUser._id}`,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ];

    for (const c of seedChecks) {
      await CheckResult.create({
        workspaceId: workspace._id,
        ...c,
      });
    }
    console.log('  ✅ Seeded sample verification checks for analytics visualization');
  }

  console.log('\n======================================================');
  console.log('🚀 TrustLayer Demo Seeding Completed!');
  console.log('------------------------------------------------------');
  console.log(`Email:    ${demoEmail}`);
  console.log(`Password: Password123!`);
  console.log('======================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeder failed:', err);
  process.exit(1);
});
