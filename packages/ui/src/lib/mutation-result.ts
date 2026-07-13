import { toast } from "sonner";

interface BetterAuthResult {
  error: { message?: string } | null;
}

interface HandleResultOptions {
  errorTitle: string;
  onSuccess?: () => void;
  successDescription?: string;
  successTitle?: string;
}

export function handleMutationResult(
  result: BetterAuthResult,
  options: HandleResultOptions
): boolean {
  if (result.error) {
    toast.error(options.errorTitle, {
      description: result.error.message ?? "Please try again.",
    });
    return false;
  }

  if (options.successTitle) {
    toast.success(options.successTitle, {
      description: options.successDescription,
    });
  }
  options.onSuccess?.();
  return true;
}
