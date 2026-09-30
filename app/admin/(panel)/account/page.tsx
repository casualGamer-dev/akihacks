import { ChangePassword, UsersPanel } from "@/components/admin/UsersPanel";
import { requireAdmin } from "@/lib/auth";
import { listUsers } from "../../actions";

export default async function Account() {
  const me = await requireAdmin();
  const users = me.role === "owner" ? await listUsers() : null;
  return (
    <>
      <h1 className="font-pixel text-4xl">{users ? "Admins & account" : "My account"}</h1>
      <h2 className="mb-4 mt-8 text-xl font-extrabold">Change my password</h2>
      <ChangePassword managed={me.env} />
      {users && (
        <>
          <h2 className="mb-4 mt-12 text-xl font-extrabold">Admins</h2>
          <p className="mb-6 max-w-xl text-muted">
            Accounts you add here sign in with their own email and password. Owners listed in the ADMIN_EMAILS
            environment variable always work and don&apos;t appear in this list.
          </p>
          <UsersPanel initial={users} me={me.email} />
        </>
      )}
    </>
  );
}
