"use client";

/**
 * MembershipGuard Component
 * 
 * This component serves as a membership access control mechanism for protected routes.
 * It verifies if the current user has a valid membership before allowing access to the wrapped content.
 * 
 * Features:
 * - Checks membership verification status via the useMembershipVerification hook
 * - Shows a loading spinner while verification is in progress
 * - Redirects non-members to the home page
 * - Only renders children if the user has a verified membership
 * 
 * Usage:
 * Wrap any component or page that requires membership verification:
 * 
 * ```tsx
 * <MembershipGuard>
 *   <ProtectedContent />
 * </MembershipGuard>
 * ```
 * 
 * @see useMembershipVerification - The hook that handles membership verification logic
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMembershipVerification } from "@/lib/hooks/unlock/useMembershipVerification";
import { Loader2 } from "lucide-react";

interface MembershipGuardProps {
  children: React.ReactNode;
}

export function MembershipGuard({ children }: MembershipGuardProps) {
  const router = useRouter();
  const { isVerified, hasMembership, isLoading } = useMembershipVerification();

  // Redirect to home page if the user doesn't have a membership
  // or if their membership could not be verified
  useEffect(() => {
    if (!isLoading && (!isVerified || !hasMembership)) {
      router.push("/");
    }
  }, [isLoading, isVerified, hasMembership, router]);

  // Display loading spinner while verification is in progress
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If no membership or verification failed, return nothing
  // (the useEffect will handle redirection)
  if (!isVerified || !hasMembership) {
    return null;
  }

  // User has a verified membership, render the protected content
  return <>{children}</>;
}
