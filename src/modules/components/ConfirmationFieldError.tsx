type ConfirmationFieldErrorProps = {
  message?: string;
};

export function ConfirmationFieldError({
  message,
}: ConfirmationFieldErrorProps) {
  if (!message) return null;

  return <p className="mt-2 text-sm text-rose-300">{message}</p>;
}
