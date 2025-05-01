/**
 * # Developer Notes: useSessionKeyStorage.ts
 *
 * ## Overview
 * A React hook that manages persistent storage and lifecycle of session keys for ERC-4337 smart accounts.
 * This hook handles secure local storage of session keys, their permissions, and automatic expiry validation.
 *
 * ## Key Functions
 *
 * - **addSessionKey()**: Stores a new session key with metadata and permissions
 * - **removeSessionKey()**: Deletes a specific session key by address
 * - **getSessionKey()**: Retrieves a session key by address
 * - **getSessionKeyByEntityId()**: Retrieves a session key by its entity ID
 * - **updateSessionKeys()**: Updates the stored session keys with validation of expiry
 *
 * ## Technical Implementation
 *
 * ### Storage Format
 * Session keys are stored in localStorage with user-specific namespacing:
 * - Storage key: `session-keys-${user.address}`
 * - Each key includes: address, private key, entity ID, permissions, and creation timestamp
 *
 * ### BigInt Serialization
 * Custom JSON serialization/deserialization to handle BigInt values:
 * - When storing: BigInt values appended with "n" (e.g., "1000000000000000000n")
 * - When loading: Strings with "n" suffix parsed back to BigInt
 *
 * ### Auto-Expiry
 * Automatically filters out expired session keys based on:
 * - Time-based limits defined in permissions.timeLimit
 * - (Note: Spending limit validation would require tracking of actual spending)
 *
 * ## Security Considerations
 * - Private keys are stored in plaintext in localStorage (only client-side)
 * - Keys should have appropriate permission restrictions and time limits
 * - Consider using more secure storage for production use cases
 * - Keys are tied to specific user accounts to prevent cross-account access
 *
 * ## Dependencies
 * - **Account Kit**: @account-kit/react for user context
 * - **Types**: Session key permissions interface from useSessionKey.ts
 * - **Browser Storage**: localStorage API
 *
 * ## Usage Example
 *
 * ```typescript
 * // Inside a component
 * const {
 *   addSessionKey,
 *   removeSessionKey,
 *   getSessionKey
 * } = useSessionKeyStorage();
 *
 * // Store a new session key
 * addSessionKey({
 *   address: "0x...",
 *   privateKey: "0x...",
 *   entityId: 1,
 *   permissions: {
 *     timeLimit: 86400, // 24 hours
 *     spendingLimit: parseEther("0.1")
 *   }
 * });
 *
 * // Retrieve a session key
 * const key = getSessionKey("0x...");
 *
 * // Remove a session key
 * removeSessionKey("0x...");
 * ```
 */

import { useState, useEffect } from "react";
import { useUser } from "@account-kit/react";
import { type SessionKeyPermissions } from "./useSessionKey";

export interface SessionKeyData {
  address: string;
  privateKey: string;
  entityId: number;
  permissions: SessionKeyPermissions;
  createdAt: number;
}

export function useSessionKeyStorage() {
  const [sessionKeys, setSessionKeys] = useState<SessionKeyData[]>([]);
  const user = useUser();

  // Load session keys from localStorage on mount
  useEffect(() => {
    if (!user?.address) return;

    const storageKey = `session-keys-${user.address}`;
    const storedKeys = localStorage.getItem(storageKey);

    if (storedKeys) {
      try {
        const parsedKeys = JSON.parse(storedKeys, (key, value) => {
          // Handle BigInt serialization
          if (
            key === "spendingLimit" &&
            typeof value === "string" &&
            value.includes("n")
          ) {
            return BigInt(value.slice(0, -1));
          }
          return value;
        });
        setSessionKeys(parsedKeys);
      } catch (error) {
        console.error("Error parsing stored session keys:", error);
        localStorage.removeItem(storageKey);
      }
    }
  }, [user?.address]);

  // Save session keys to localStorage whenever they change
  const updateSessionKeys = (newKeys: SessionKeyData[]) => {
    if (!user?.address) return;

    const storageKey = `session-keys-${user.address}`;

    // Filter out expired session keys
    const currentTime = Math.floor(Date.now() / 1000);
    const validKeys = newKeys.filter((key) => {
      // Check time-based expiry
      if (key.permissions.timeLimit) {
        const expiryTime = key.createdAt + key.permissions.timeLimit;
        if (expiryTime <= currentTime) return false;
      }

      // Check spending limit (if applicable)
      // Note: This would require tracking actual spending in a real implementation
      return true;
    });

    setSessionKeys(validKeys);

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(validKeys, (key, value) => {
          // Handle BigInt serialization
          if (typeof value === "bigint") {
            return value.toString() + "n";
          }
          return value;
        })
      );
    } catch (error) {
      console.error("Error storing session keys:", error);
    }
  };

  const addSessionKey = (key: Omit<SessionKeyData, "createdAt">) => {
    const newKey = {
      ...key,
      createdAt: Math.floor(Date.now() / 1000),
    };
    const newKeys = [...sessionKeys, newKey];
    updateSessionKeys(newKeys);
    return newKey;
  };

  const removeSessionKey = (address: string) => {
    const newKeys = sessionKeys.filter((key) => key.address !== address);
    updateSessionKeys(newKeys);
  };

  const getSessionKey = (address: string) => {
    return sessionKeys.find((key) => key.address === address);
  };

  const getSessionKeyByEntityId = (entityId: number) => {
    return sessionKeys.find((key) => key.entityId === entityId);
  };

  return {
    sessionKeys,
    addSessionKey,
    removeSessionKey,
    getSessionKey,
    getSessionKeyByEntityId,
    updateSessionKeys,
  };
}
