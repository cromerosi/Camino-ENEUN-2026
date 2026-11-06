type ConfirmationFieldErrorProps = {
  id?: string;
  message?: string;
};

export function ConfirmationFieldError({
  id,
  message,
}: ConfirmationFieldErrorProps) {
  if (!message) return null;

  return (
    <p id={id} role="alert" className="mt-2 text-sm text-rose-300">
      {message}
    </p>
  );
}
