import fs from 'fs';
import FormData from 'form-data';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

export interface AICheckResponse {
  workspace_id: string;
  question: string;
  answer: string;
  overall_verdict: 'SUPPORTED' | 'CONTRADICTED' | 'UNVERIFIABLE';
  reliability_score: number;
  total_claims: number;
  supported_count: number;
  contradicted_count: number;
  unverifiable_count: number;
  claims: Array<{
    claim: string;
    verdict: 'SUPPORTED' | 'CONTRADICTED' | 'UNVERIFIABLE';
    confidence: number;
    evidence_sentence?: string | null;
    chunk_id?: string | null;
    scores: {
      entailment: number;
      contradiction: number;
      neutral: number;
    };
  }>;
  self_consistency_agreement?: number | null;
}

export interface AIIngestResponse {
  workspace_id: string;
  document_id: string;
  filename: string;
  chunks_count: number;
  characters_count: number;
}

export class AIServiceClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.AI_SERVICE_URL.replace(/\/$/, '');
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) return false;
      const json: any = await res.json();
      return json.success === true;
    } catch {
      return false;
    }
  }

  async ingestDocument(
    workspaceId: string,
    documentId: string,
    filePath: string,
    originalFilename: string
  ): Promise<AIIngestResponse> {
    const form = new FormData();
    form.append('workspace_id', workspaceId);
    form.append('document_id', documentId);
    form.append('file', fs.createReadStream(filePath), {
      filename: originalFilename,
    });

    try {
      const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        form.submit(`${this.baseUrl}/ingest`, (err, response) => {
          if (err) return reject(err);
          let data = '';
          response.on('data', (chunk) => (data += chunk));
          response.on('end', () => resolve({ status: response.statusCode || 500, body: data }));
          response.on('error', reject);
        });
      });

      const parsed = JSON.parse(res.body);
      if (res.status !== 200 || !parsed.success) {
        const errorMsg = parsed.error?.message || 'Failed to ingest document in AI engine';
        throw new AppError(errorMsg, res.status >= 400 && res.status < 500 ? res.status : 502, 'AI_INGEST_FAILED');
      }

      return parsed.data as AIIngestResponse;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`AI Service connection error during ingestion: ${error.message}`, 502, 'AI_SERVICE_UNAVAILABLE');
    }
  }

  async checkAnswer(
    workspaceId: string,
    question: string,
    answer: string,
    regenerate = false
  ): Promise<AICheckResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          question,
          answer,
          regenerate,
        }),
      });

      const json: any = await response.json();
      if (!response.ok || !json.success) {
        const msg = json.error?.message || 'AI verification failed';
        throw new AppError(msg, response.status >= 400 && response.status < 500 ? response.status : 502, 'AI_CHECK_FAILED');
      }

      return json.data as AICheckResponse;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`AI Service connection error: ${error.message}`, 502, 'AI_SERVICE_UNAVAILABLE');
    }
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/workspace/${workspaceId}`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.warn(`Failed to delete AI workspace index: ${e}`);
    }
  }
}

export const aiServiceClient = new AIServiceClient();
