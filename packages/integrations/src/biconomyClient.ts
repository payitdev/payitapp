export interface BiconomyConfig {
  apiKey: string;
  projectId: string;
  baseUrl?: string;
}

export interface ComposeQuotePayload {
  userOp: Record<string, any>;
  chainId: number;
  mode?: 'gasless' | 'token';
  sponsor?: boolean;
  instructions?: Array<{
    to: string;
    data: string;
    value?: string;
  }>;
}

export interface SupertransactionPayload {
  quoteId?: string;
  signature: string;
  userOp: Record<string, any>;
  chainId: number;
}

export class BiconomyClient {
  private apiKey: string;
  private projectId: string;
  private baseUrl: string;

  constructor(config?: Partial<BiconomyConfig>) {
    this.apiKey = config?.apiKey || process.env.BICONOMY_MEE_API_KEY || '';
    this.projectId = config?.projectId || process.env.BICONOMY_PROJECT_ID || '';
    this.baseUrl = config?.baseUrl || process.env.BICONOMY_MEE_BASE_URL || 'https://mee-node.biconomy.io';
  }

  private getHeaders(): Record<string, string> {
    if (!this.apiKey || !this.projectId) {
      throw new Error('Biconomy API key and project ID are required.');
    }
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'x-project-id': this.projectId,
    };
  }

  /**
   * Fetch orchestrator smart contract addresses across EVM chains
   */
  async getOrchestratorAddresses(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/mee/orchestrator-addresses`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Biconomy Orchestrator Fetch Error (${response.status}): ${errText}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error('[BiconomyClient] getOrchestratorAddresses error:', err.message);
      throw new Error(`Biconomy orchestrator lookup unavailable: ${err.message}`);
    }
  }

  /**
   * Compose instructions and generate a gasless / MEE execution quote
   */
  async composeInstructionsAndGenerateQuote(payload: ComposeQuotePayload): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/mee/compose-instructions-and-generate-a-quote`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          projectId: this.projectId,
          chainId: payload.chainId,
          mode: payload.mode || 'gasless',
          sponsor: payload.sponsor !== undefined ? payload.sponsor : true,
          userOp: payload.userOp,
          instructions: payload.instructions || [],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Biconomy Quote Error (${response.status}): ${errText}`);
      }

      const result = await response.json();
      const quote = result?.quote || result;
      if (!quote?.userOp && !quote?.userOperation) {
        throw new Error('Biconomy returned no signable user operation. Verify the signer wallet and strategy instructions.');
      }
      return quote;
    } catch (err: any) {
      console.error('[BiconomyClient] quote generation failed:', err.message);
      throw err;
    }
  }

  /**
   * Submit the signed supertransaction for MEE execution
   */
  async submitSupertransaction(payload: SupertransactionPayload): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/mee/submit-the-supertransaction-for-execution`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          projectId: this.projectId,
          quoteId: payload.quoteId,
          signature: payload.signature,
          userOp: payload.userOp,
          chainId: payload.chainId,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Biconomy Submit Error (${response.status}): ${errText}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error('[BiconomyClient] supertransaction submission failed:', err.message);
      throw new Error(`Biconomy execution unavailable: ${err.message}`);
    }
  }
}
