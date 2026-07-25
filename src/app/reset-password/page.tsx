import { PasswordForm } from "@/components/PasswordForm";

export const metadata = {
  title: "Set a new password",
};

// Where a recovery email lands, by way of /auth/callback?next=/reset-password.
// The callback exchanges the link's one-time code for a real session before
// redirecting here, so by this point updateUser() has a session to act on.
//
// No BottomNav on purpose: someone arriving from a recovery email is mid-flow
// and not signed in the ordinary way, so the app's main navigation would be a
// distraction rather than a help.
export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-md px-6 pt-14 pb-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set a new password
        </h1>
        <p className="mt-1 text-sm text-muted">
          Almost done. Choose a new password and you&apos;re back in.
        </p>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-6 pb-16 pt-6">
        <PasswordForm
          submitLabel="Set password and sign in"
          doneMessage="You're all set."
          nextHref="/"
        />
      </main>
    </div>
  );
}
