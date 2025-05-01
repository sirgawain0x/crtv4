/**
 * # Developer Notes: useSessionKey.ts
 *
 * ## Overview
 * A React hook that manages session keys for ERC-4337 smart accounts using Account Kit. Session keys enable delegated
 * transaction permissions with configurable constraints, allowing controlled access from multiple devices without
 * exposing the main wallet.
 *
 * ## Key Functions
 *
 * - **createSessionKey()**: Generates a new session key with private key, client, and entity ID
 * - **useSessionKeyClient()**: Recreates client from existing session key private key and entity ID
 * - **isInstalling**: Loading state during session key creation process
 *
 * ## Technical Implementation
 *
 * ### Session Key Permissions
 * ```typescript
 * SessionKeyPermissions {
 *   isGlobal?: boolean        // Full access to account when true
 *   allowedFunctions?: string[] // Specific function selectors that can be called
 *   timeLimit?: number        // Expiration time in seconds
 *   spendingLimit?: bigint    // Maximum token amount allowed to spend
 *   allowedAddresses?: string[] // Addresses the key can interact with
 * }
 * ```
 *
 * ### How It Works
 * 1. Creates a random private key using viem's generatePrivateKey()
 * 2. Converts private key to LocalAccountSigner for signing transactions
 * 3. Creates modular account client with session key configuration
 * 4. Assigns sequential entity IDs (1, 2, 3...) for each session key
 * 5. Stores session key details for later retrieval
 *
 * ### Error Handling
 * - Validates smart account initialization before operations
 * - Validates chain selection is complete
 * - Verifies Alchemy API key availability
 * - Provides descriptive error messages
 *
 * ## Dependencies
 * - **Account Kit**: @account-kit/react, @account-kit/smart-contracts
 * - **Account Abstraction**: @aa-sdk/core
 * - **Blockchain**: viem/accounts
 * - **Storage**: useSessionKeyStorage (custom hook)
 * - **Environment**: Requires NEXT_PUBLIC_ALCHEMY_API_KEY
 *
 * ## Usage Examples
 *
 * ```typescript
 * // Create a session key with spending limit
 * const { createSessionKey } = useSessionKey({
 *   permissions: {
 *     spendingLimit: parseEther("0.1")
 *   }
 * });
 *
 * // Create key with function restrictions
 * const { createSessionKey } = useSessionKey({
 *   permissions: {
 *     allowedFunctions: ["0x23b872dd"] // transferFrom selector
 *   }
 * });
 *
 * // Recreate client from stored key
 * const { useSessionKeyClient } = useSessionKey();
 * const client = await useSessionKeyClient(storedPrivateKey, storedEntityId);
 * ```
 *
 * ## Security Considerations
 * - Store session keys securely - compromise allows transactions within permissions
 * - Set appropriate permission constraints for intended use cases
 * - Consider time limits for temporary access scenarios
 * - Monitor and revoke session keys when no longer needed
 */

import { useCallback, useState } from "react";
import { useSmartAccountClient, useChain } from "@account-kit/react";
import { generatePrivateKey } from "viem/accounts";
import { LocalAccountSigner } from "@aa-sdk/core";
import { createModularAccountV2Client } from "@account-kit/smart-contracts";
import { type SmartAccountSigner } from "@aa-sdk/core";
import { alchemy } from "@account-kit/infra";
import { useSessionKeyStorage } from "./useSessionKeyStorage";

export interface SessionKeyPermissions {
  isGlobal?: boolean;
  allowedFunctions?: string[];
  timeLimit?: number; // in seconds
  spendingLimit?: bigint;
  allowedAddresses?: string[];
}

interface UseSessionKeyOptions {
  permissions?: SessionKeyPermissions;
}

export function useSessionKey(options: UseSessionKeyOptions = {}) {
  const { chain } = useChain();
  const { client: smartAccountClient } = useSmartAccountClient({
    type: "ModularAccountV2",
    accountParams: {
      mode: "default",
    },
  });
  const [isInstalling, setIsInstalling] = useState(false);
  const { sessionKeys } = useSessionKeyStorage();

  const createSessionKey = useCallback(async () => {
    if (!smartAccountClient?.account || !chain) {
      throw new Error("Smart account not initialized or chain not selected");
    }

    setIsInstalling(true);

    try {
      // Generate session key
      const sessionKeyPrivate = generatePrivateKey();
      const sessionKeySigner: SmartAccountSigner =
        LocalAccountSigner.privateKeyToAccountSigner(sessionKeyPrivate);

      // Get API key from existing transport
      const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

      if (!apiKey) {
        throw new Error("Alchemy API key not found");
      }

      // Calculate next entityId based on existing session keys
      const nextEntityId = sessionKeys.length + 1;

      // Create session key client
      const sessionKeyClient = await createModularAccountV2Client({
        chain,
        transport: alchemy({ apiKey }),
        signer: sessionKeySigner,
        accountAddress: smartAccountClient.getAddress(),
        signerEntity: {
          entityId: nextEntityId,
          isGlobalValidation: options.permissions?.isGlobal ?? false,
        },
      });

      // Verify session key client
      const sessionKeyAddress = await sessionKeySigner.getAddress();
      if (!sessionKeyAddress) {
        throw new Error("Failed to get session key address");
      }

      return {
        sessionKeyPrivate,
        sessionKeyClient,
        sessionKeyAddress,
        entityId: nextEntityId,
      };
    } catch (error) {
      console.error("Error creating session key:", error);
      throw error;
    } finally {
      setIsInstalling(false);
    }
  }, [
    smartAccountClient,
    chain,
    options.permissions?.isGlobal,
    sessionKeys.length,
  ]);

  const useSessionKeyClient = useCallback(
    async (sessionKeyPrivate: string, entityId: number) => {
      if (!smartAccountClient?.account || !chain) {
        throw new Error("Smart account not initialized or chain not selected");
      }

      const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
      if (!apiKey) {
        throw new Error("Alchemy API key not found");
      }

      const sessionKeySigner = LocalAccountSigner.privateKeyToAccountSigner(
        sessionKeyPrivate as `0x${string}`
      );

      return createModularAccountV2Client({
        chain,
        transport: alchemy({ apiKey }),
        signer: sessionKeySigner,
        accountAddress: smartAccountClient.getAddress(),
        signerEntity: {
          entityId,
          isGlobalValidation: options.permissions?.isGlobal ?? false,
        },
      });
    },
    [smartAccountClient, chain, options.permissions?.isGlobal]
  );

  return {
    createSessionKey,
    useSessionKeyClient,
    isInstalling,
  };
}
