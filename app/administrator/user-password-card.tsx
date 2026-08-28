import { UserPasswordPill } from "@/app/administrator/user-password-pill";

export function UserPasswordCard({ userId }: { userId: string }) {
  return <UserPasswordPill userId={userId} />;
}
