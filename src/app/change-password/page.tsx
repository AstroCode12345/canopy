import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { PasswordForm } from "@/components/PasswordForm";

export const metadata = {
  title: "Change password",
};

// Reachable only behind the middleware's auth check, so anyone here already
// has a session for updateUser() to act on.
export default function ChangePasswordPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-md px-6 pt-10 pb-2">
        <Link
          href="/settings"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Settings
        </Link>
        <h1 className="text-[23px] font-extrabold leading-[1.2]">
          Change password
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pick something you don&apos;t use anywhere else.
        </p>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-6 pb-28 pt-6">
        <PasswordForm
          submitLabel="Save new password"
          doneMessage="Your password is updated."
          nextHref="/settings"
        />
      </main>

      <BottomNav />
    </div>
  );
}
