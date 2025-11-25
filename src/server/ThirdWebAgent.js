import { createThirdwebAI } from "@thirdweb-dev/ai-sdk-provider";
import { streamText } from "ai";

/**
 * Minimal ThirdWeb-based On-Chain Agent for RPG-Kit
 */
export class ThirdWebAgent {
  constructor() {
    this.thirdwebAI = null;
  }

  async initialize() {
    if (!process.env.THIRDWEB_SECRET_KEY) {
      throw new Error("THIRDWEB_SECRET_KEY not found in environment variables");
    }

    this.thirdwebAI = createThirdwebAI({
      secretKey: process.env.THIRDWEB_SECRET_KEY,
    });

    console.log("✅ ThirdWeb AI Agent initialized");
  }

  async executeCommand(command, userAddress, chainId, remotePlayers = [], playerId) {
    try {
      // Build game context with connected players and network
      const playersContext = remotePlayers
        .map((p) => `- ${p.name}: ${p.address}`)
        .join("\n");

      const gameContext = `
You are a blockchain assistant in an RPG game.

USER WALLET: ${userAddress}
CONNECTED NETWORK: Chain ID ${chainId}

Connected players (valid addresses for transfers):
${playersContext}`;

      const messages = [
        {
          role: "user",
          content: `${command}\n\n${gameContext}`,
        },
      ];

      const sessionId = `${userAddress}-${playerId}`;
      const chainIdNum = parseInt(chainId, 10);

      const model = this.thirdwebAI.chat(sessionId, {
        context: {
          chain_ids: [chainIdNum],
          from: userAddress,
          auto_execute_transactions: true, // Enable tools - wallet still requires your signature
        },
      });

      const result = await streamText({
        model,
        messages,
        tools: this.thirdwebAI.tools(),
        maxSteps: 5,
      });

      let fullMessage = "";
      for await (const chunk of result.textStream) {
        fullMessage += chunk;
      }

      // Log for debugging
      console.log("Tool Results:", result.toolResults);
      console.log("Tool Uses:", result.toolUses);

      return {
        success: true,
        message: fullMessage,
        actions: result.toolResults || result.toolUses || [],
        data: {
          address: userAddress,
          chainId,
        },
      };
    } catch (error) {
      console.error("ThirdWeb Agent error:", error);
      return {
        success: false,
        message: `Error: ${error.message}`,
        data: {
          address: userAddress,
          chainId,
        },
      };
    }
  }
}
